import "server-only";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { addDays } from "@/lib/time";
import { notify } from "@/lib/notify";
import { orderEvent } from "@/lib/orders";
import { shippoAdapter } from "@/lib/carriers/shippo";
import type { CarrierAdapter, PostalAddress, TrackingUpdate } from "@/lib/carriers/types";
import type { ShipmentDirection, ShipmentStatus } from "@/generated/prisma/enums";

export function activeCarrier(): CarrierAdapter | null {
  return shippoAdapter.isConfigured() ? shippoAdapter : null;
}

type Snapshot = { fullName: string; line1: string; line2?: string | null; city: string; postcode: string; country?: string; phone?: string | null };
const toPostal = (a: Snapshot, email?: string | null): PostalAddress => ({
  name: a.fullName, line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode, country: a.country ?? "GB", phone: a.phone, email,
});

/**
 * Generates the prepaid label for an order (outbound) or a return. Failures are recorded on the
 * shipment with a clear reason; sellers can still post the item themselves and add tracking.
 */
export async function createLabelForOrder(orderId: string, direction: ShipmentDirection = "OUTBOUND") {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { include: { listing: { include: { parcelSize: true } } } },
      seller: { select: { email: true, addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], take: 1 } } },
      buyer: { select: { email: true } },
    },
  });
  if (order.deliveryType !== "HOME" && direction === "OUTBOUND") return null;

  const existing = await db.shipment.findFirst({ where: { orderId, direction, status: { notIn: ["FAILED", "RETURNED"] }, labelUrl: { not: null } } });
  if (existing) return existing;
  const shipment =
    (await db.shipment.findFirst({ where: { orderId, direction, labelUrl: null } })) ??
    (await db.shipment.create({ data: { orderId, direction } }));

  const carrier = activeCarrier();
  const sellerAddress = order.seller.addresses[0];
  const buyerAddress = order.shippingAddress as Snapshot | null;
  const fail = async (msg: string) => {
    await db.shipment.update({ where: { id: shipment.id }, data: { lastError: msg } });
    return null;
  };
  if (!carrier) return fail("Prepaid labels aren't available yet. Post the item yourself and add the tracking number below.");
  if (!sellerAddress) return fail("Add your address in Settings → Addresses so we can create your label.");
  if (!buyerAddress) return fail("The buyer's address is missing.");

  const parcels = order.items.map((i) => i.listing.parcelSize).filter(Boolean);
  const biggest = parcels.sort((a, b) => b!.maxWeightGrams - a!.maxWeightGrams)[0]!;
  const sellerPostal = toPostal({ ...sellerAddress, country: sellerAddress.country }, order.seller.email);
  const buyerPostal = toPostal(buyerAddress, order.buyer.email);
  try {
    const label = await carrier.createLabel({
      from: direction === "OUTBOUND" ? sellerPostal : buyerPostal,
      to: direction === "OUTBOUND" ? buyerPostal : sellerPostal,
      parcel: { lengthCm: biggest.lengthCm, widthCm: biggest.widthCm, heightCm: biggest.heightCm, weightGrams: biggest.maxWeightGrams },
      reference: `${order.number}${direction === "RETURN" ? "-R" : ""}`,
    });
    return db.shipment.update({
      where: { id: shipment.id },
      data: { ...label, status: "LABEL_CREATED", lastError: null },
    });
  } catch (err) {
    console.error("[label]", order.number, err);
    return fail("We couldn't create a label automatically. Post the item yourself and add tracking, or contact support.");
  }
}

/** Seller posts the item without our label and enters tracking manually. */
export async function addManualTracking(input: { orderId: string; sellerId: string; carrier: string; trackingNumber: string }) {
  const order = await db.order.findFirst({ where: { id: input.orderId, sellerId: input.sellerId, status: "PAID", deliveryType: "HOME" }, include: { items: true } });
  if (!order) throw new ActionError("This order can't be updated.");
  const existing = await db.shipment.findFirst({ where: { orderId: order.id, direction: "OUTBOUND" } });
  const data = { carrier: input.carrier, trackingNumber: input.trackingNumber, status: "IN_TRANSIT" as ShipmentStatus, lastError: null };
  if (existing) await db.shipment.update({ where: { id: existing.id }, data });
  else await db.shipment.create({ data: { orderId: order.id, ...data } });
  await markShipped(order.id);
}

export async function markShipped(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.status !== "PAID") return;
  await db.order.update({ where: { id: orderId }, data: { status: "SHIPPED", shippedAt: new Date() } });
  await orderEvent(order, "The seller has sent the item");
  await notify({ userId: order.buyerId, type: "SHIPPING_UPDATE", title: "Your order is on its way", body: `Order ${order.number} has been sent. Track it on the order page.`, url: `/orders/${order.id}` });
}

/** Delivered (carrier scan or in-person handover): starts the problem-reporting window. */
export async function markDelivered(orderId: string, note = "Delivered") {
  const s = await getSettings();
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !["PAID", "SHIPPED"].includes(order.status)) return;
  const now = new Date();
  await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED", deliveredAt: now, autoReleaseAt: addDays(now, s.autoReleaseDays) } });
  await orderEvent(order, `${note}. The buyer has ${s.disputeWindowDays} days to report a problem.`);
  await notify({
    userId: order.buyerId,
    type: "SHIPPING_UPDATE",
    title: "Your item has arrived",
    body: `Check it over, then tap “Everything is OK”. If something's wrong, report it within ${s.disputeWindowDays} days – after that the payment is released to the seller.`,
    url: `/orders/${order.id}`,
  });
  await notify({ userId: order.sellerId, type: "SHIPPING_UPDATE", title: `Order ${order.number} delivered`, body: `Your earnings are released when the buyer confirms, or automatically in ${s.autoReleaseDays} days.`, url: `/orders/${order.id}` });
}

/** Applies a carrier tracking update (idempotent per status/time). */
export async function applyTrackingUpdate(u: TrackingUpdate) {
  const shipment = await db.shipment.findFirst({ where: { trackingNumber: u.trackingNumber }, orderBy: { createdAt: "desc" } });
  if (!shipment) return { matched: false };
  try {
    await db.trackingEvent.create({ data: { shipmentId: shipment.id, status: u.status, description: u.description.slice(0, 300), location: u.location, occurredAt: u.occurredAt } });
  } catch {
    return { matched: true, duplicate: true };
  }
  await db.shipment.update({ where: { id: shipment.id }, data: { status: u.status } });

  if (shipment.direction === "OUTBOUND") {
    if (["IN_TRANSIT", "OUT_FOR_DELIVERY", "AVAILABLE_FOR_PICKUP"].includes(u.status)) await markShipped(shipment.orderId);
    if (u.status === "DELIVERED") await markDelivered(shipment.orderId, "Delivered by the carrier");
    if (u.status === "OUT_FOR_DELIVERY" || u.status === "FAILED" || u.status === "AVAILABLE_FOR_PICKUP") {
      const order = await db.order.findUniqueOrThrow({ where: { id: shipment.orderId } });
      await notify({ userId: order.buyerId, type: "SHIPPING_UPDATE", title: u.status === "OUT_FOR_DELIVERY" ? "Out for delivery today" : u.status === "FAILED" ? "Delivery problem" : "Ready to collect", body: u.description, url: `/orders/${order.id}` });
    }
  } else if (u.status === "DELIVERED") {
    const { onReturnDelivered } = await import("@/lib/disputes");
    await onReturnDelivered(shipment.orderId);
  }
  return { matched: true };
}

export async function bookCollection(input: { orderId: string; sellerId: string; date: Date }) {
  const carrier = activeCarrier();
  if (!carrier?.bookCollection) throw new ActionError("Collections aren't available – please use a drop-off point.");
  const order = await db.order.findFirst({ where: { id: input.orderId, sellerId: input.sellerId, status: "PAID" }, include: { seller: { select: { email: true, addresses: { orderBy: { isDefault: "desc" }, take: 1 } } } } });
  const shipment = order ? await db.shipment.findFirst({ where: { orderId: order.id, direction: "OUTBOUND", providerLabelId: { not: null } } }) : null;
  if (!order || !shipment?.providerLabelId || !order.seller.addresses[0]) throw new ActionError("Create the label first.");
  try {
    const res = await carrier.bookCollection({ providerLabelId: shipment.providerLabelId, from: toPostal(order.seller.addresses[0], order.seller.email), date: input.date });
    await db.shipment.update({ where: { id: shipment.id }, data: { sendMethod: "COLLECTION" } });
    return res;
  } catch (err) {
    console.error("[collection]", err);
    throw new ActionError("This carrier can't collect from your address – please use a drop-off point.");
  }
}
