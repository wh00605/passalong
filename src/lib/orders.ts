import "server-only";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { quoteOrder } from "@/lib/fees";
import { formatPence } from "@/lib/money";
import { addDays, addWorkingDays } from "@/lib/time";
import { isBlockedBetween } from "@/lib/blocks";
import { getStripe } from "@/lib/stripe";
import { creditSale, debitRefund, releaseSale } from "@/lib/wallet";
import { insertMessage } from "@/lib/messaging";
import { notify } from "@/lib/notify";
import { recordPaymentFailure } from "@/lib/fraud";
import type { DeliveryType, Prisma } from "@/generated/prisma/client";

const orderNumber = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
const CHECKOUT_LOCK_MINUTES = 15;

export const OPEN_ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "DISPUTED"] as const;

/** Loads listings for checkout and checks every rule a purchase must satisfy. */
async function checkoutListings(buyerId: string, listingIds: string[]) {
  const ids = [...new Set(listingIds)].slice(0, 20);
  if (ids.length === 0) throw new ActionError("Choose at least one item.");
  const listings = await db.listing.findMany({
    where: { id: { in: ids } },
    include: { parcelSize: true, photos: { orderBy: { position: "asc" }, take: 1 }, seller: { select: { id: true, holidayMode: true, deletedAt: true, banned: true, bundleDiscountsEnabled: true, bundleTiers: true } } },
  });
  if (listings.length !== ids.length) throw new ActionError("One of these items isn't available any more.");
  const sellerId = listings[0].sellerId;
  for (const l of listings) {
    if (l.sellerId !== sellerId) throw new ActionError("A bundle can only contain items from one seller.");
    if (l.sellerId === buyerId) throw new ActionError("You can't buy your own item.");
    const available = l.moderationStatus === "OK" && (l.status === "ACTIVE" || (l.status === "RESERVED" && l.reservedForId === buyerId));
    if (!available || l.seller.holidayMode || l.seller.deletedAt || l.seller.banned) throw new ActionError(`“${l.title}” isn't available any more.`);
    if (!l.parcelSize) throw new ActionError(`“${l.title}” has no parcel size set.`);
  }
  if (await isBlockedBetween(buyerId, sellerId)) throw new ActionError("You can't buy from this member.");

  // Soft lock: someone else is mid-checkout for one of these items.
  const locked = await db.orderItem.findFirst({
    where: {
      listingId: { in: ids },
      order: { status: "PENDING_PAYMENT", buyerId: { not: buyerId }, createdAt: { gt: new Date(Date.now() - CHECKOUT_LOCK_MINUTES * 60_000) } },
    },
  });
  if (locked) throw new ActionError("Someone else is checking out this item right now. Try again in a few minutes.");
  return listings;
}

/** Shipping for a bundle is the largest parcel in it (they're sent together). */
function bundleShipping(listings: { parcelSize: { pricePence: number } | null }[]) {
  return Math.max(...listings.map((l) => l.parcelSize?.pricePence ?? 0));
}

export async function createCheckoutOrder(input: { buyerId: string; listingIds?: string[]; offerId?: string }) {
  const settings = await getSettings();
  let listingIds = input.listingIds ?? [];
  let offer = null;
  if (input.offerId) {
    offer = await db.offer.findUnique({ where: { id: input.offerId }, include: { items: true } });
    if (!offer || offer.buyerId !== input.buyerId || offer.status !== "ACCEPTED" || offer.expiresAt < new Date()) {
      throw new ActionError("That offer can no longer be used.");
    }
    listingIds = offer.items.map((i) => i.listingId);
  }
  const listings = await checkoutListings(input.buyerId, listingIds);
  const seller = listings[0].seller;

  // Re-use this buyer's own unpaid order for the same items, if any.
  await db.order.updateMany({
    where: { buyerId: input.buyerId, status: "PENDING_PAYMENT", items: { some: { listingId: { in: listingIds } } } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Replaced by a new checkout" },
  });

  const address = await db.address.findFirst({ where: { userId: input.buyerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  const q = quoteOrder({
    itemPrices: listings.map((l) => l.pricePence),
    offerPence: offer?.amountPence ?? null,
    shippingPence: bundleShipping(listings),
    bundleTiers: seller.bundleTiers,
    bundleDiscountsEnabled: seller.bundleDiscountsEnabled,
    settings,
  });
  return db.order.create({
    data: {
      number: `PA-${orderNumber()}`,
      buyerId: input.buyerId,
      sellerId: seller.id,
      offerId: offer?.id,
      itemsSubtotalPence: q.itemsSubtotalPence,
      bundleDiscountPence: q.itemsSubtotalPence - q.discountedItemsPence,
      shippingPence: q.shippingPence,
      buyerProtectionFeePence: q.buyerProtectionFeePence,
      totalPence: q.totalPence,
      sellerEarningsPence: q.sellerEarningsPence,
      deliveryType: "HOME",
      shippingAddress: address ? addressSnapshot(address) : undefined,
      items: {
        create: listings.map((l) => ({ listingId: l.id, title: l.title, pricePence: l.pricePence, photoKey: l.photos[0]?.storageKey })),
      },
    },
  });
}

export function addressSnapshot(a: { fullName: string; line1: string; line2: string | null; city: string; postcode: string; country: string; phone: string | null }) {
  return { fullName: a.fullName, line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode, country: a.country, phone: a.phone };
}

/** Changes delivery method/address on an unpaid order and re-prices it. */
export async function setDelivery(input: { orderId: string; buyerId: string; deliveryType: DeliveryType; addressId?: string }) {
  const order = await db.order.findFirst({ where: { id: input.orderId, buyerId: input.buyerId, status: "PENDING_PAYMENT" }, include: { items: { include: { listing: { include: { parcelSize: true } } } }, offer: true } });
  if (!order) throw new ActionError("This checkout has expired. Please start again.");
  if (input.deliveryType === "PICKUP_POINT") throw new ActionError("Pick-up point delivery isn't available yet.");
  let shippingAddress: Prisma.InputJsonValue | undefined;
  if (input.deliveryType === "HOME") {
    const address = await db.address.findFirst({ where: { id: input.addressId ?? "", userId: input.buyerId } });
    if (!address) throw new ActionError("Choose a delivery address.");
    shippingAddress = addressSnapshot(address);
  }
  const settings = await getSettings();
  const seller = await db.user.findUniqueOrThrow({ where: { id: order.sellerId }, select: { bundleDiscountsEnabled: true, bundleTiers: true } });
  const q = quoteOrder({
    itemPrices: order.items.map((i) => i.pricePence),
    offerPence: order.offer?.amountPence ?? null,
    shippingPence: input.deliveryType === "IN_PERSON" ? 0 : bundleShipping(order.items.map((i) => i.listing)),
    bundleTiers: seller.bundleTiers,
    bundleDiscountsEnabled: seller.bundleDiscountsEnabled,
    settings,
  });
  return db.order.update({
    where: { id: order.id },
    data: {
      deliveryType: input.deliveryType,
      shippingAddress: shippingAddress ?? undefined,
      shippingPence: q.shippingPence,
      buyerProtectionFeePence: q.buyerProtectionFeePence,
      totalPence: q.totalPence,
      sellerEarningsPence: q.sellerEarningsPence,
      bundleDiscountPence: q.itemsSubtotalPence - q.discountedItemsPence,
    },
  });
}

/** Creates (or updates) the Stripe PaymentIntent for an unpaid order. Card data never touches our servers. */
export async function preparePayment(orderId: string, buyerId: string) {
  const stripe = getStripe();
  if (!stripe) throw new ActionError("Payments aren't set up on this site yet.");
  const order = await db.order.findFirst({ where: { id: orderId, buyerId, status: "PENDING_PAYMENT" }, include: { buyer: { select: { email: true, name: true, stripeCustomerId: true } } } });
  if (!order) throw new ActionError("This checkout has expired. Please start again.");
  if (order.deliveryType === "HOME" && !order.shippingAddress) throw new ActionError("Add a delivery address first.");
  await checkoutListings(buyerId, (await db.orderItem.findMany({ where: { orderId }, select: { listingId: true } })).map((i) => i.listingId));

  let customerId = order.buyer.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: order.buyer.email, name: order.buyer.name, metadata: { userId: buyerId } });
    customerId = customer.id;
    await db.user.update({ where: { id: buyerId }, data: { stripeCustomerId: customerId } });
  }

  if (order.stripePaymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (existing.status === "succeeded") throw new ActionError("This order has already been paid.");
    if (existing.amount !== order.totalPence) {
      const updated = await stripe.paymentIntents.update(existing.id, { amount: order.totalPence });
      return { clientSecret: updated.client_secret!, amountPence: order.totalPence };
    }
    return { clientSecret: existing.client_secret!, amountPence: order.totalPence };
  }

  const pi = await stripe.paymentIntents.create(
    {
      amount: order.totalPence,
      currency: "gbp",
      customer: customerId,
      automatic_payment_methods: { enabled: true }, // cards, Apple Pay, Google Pay
      description: `Passalong order ${order.number}`,
      transfer_group: order.id,
      metadata: { kind: "order", orderId: order.id, orderNumber: order.number, buyerId, sellerId: order.sellerId },
    },
    { idempotencyKey: `order-pi-${order.id}` },
  );
  await db.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: pi.id } });
  return { clientSecret: pi.client_secret!, amountPence: order.totalPence };
}

async function orderConversation(order: { buyerId: string; sellerId: string; items: { listingId: string }[] }) {
  return db.conversation.upsert({
    where: { listingId_buyerId: { listingId: order.items[0].listingId, buyerId: order.buyerId } },
    create: { listingId: order.items[0].listingId, buyerId: order.buyerId, sellerId: order.sellerId },
    update: {},
  });
}

export async function orderEvent(order: { id: string; buyerId: string; sellerId: string; items: { listingId: string }[] }, body: string) {
  const conv = await orderConversation(order);
  await insertMessage({ conversationId: conv.id, senderId: null, type: "ORDER_EVENT", orderId: order.id, body });
}

/**
 * Webhook: payment succeeded. Idempotent. Marks items sold atomically; if another buyer won the race,
 * the payment is refunded in full automatically.
 */
export async function handlePaymentSucceeded(paymentIntentId: string, chargeId: string | null) {
  const settings = await getSettings();
  const order = await db.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, include: { items: true } });
  if (!order) return { status: "unknown-order" as const };
  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") return { status: "already-processed" as const };

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    // Atomically claim every listing: only succeeds if each is still for sale.
    const claimed = await tx.listing.updateMany({
      where: { id: { in: order.items.map((i) => i.listingId) }, OR: [{ status: "ACTIVE" }, { status: "RESERVED", reservedForId: order.buyerId }] },
      data: { status: "SOLD", soldAt: now, reservedForId: null },
    });
    if (claimed.count !== order.items.length) return "lost-race" as const;
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID", paidAt: now, stripeChargeId: chargeId, cancelledAt: null, cancelReason: null,
        shipBy: order.deliveryType === "IN_PERSON" ? addDays(now, 14) : addWorkingDays(now, settings.shipByWorkingDays),
        handoverCodeHash: order.deliveryType === "IN_PERSON" ? "derived" : null,
      },
    });
    if (order.offerId) await tx.offer.update({ where: { id: order.offerId }, data: { status: "USED" } });
    await creditSale(tx, order);
    // Other buyers' open offers on these items can no longer be honoured.
    await tx.offer.updateMany({
      where: { status: { in: ["PENDING", "ACCEPTED"] }, id: { not: order.offerId ?? "" }, items: { some: { listingId: { in: order.items.map((i) => i.listingId) } } } },
      data: { status: "EXPIRED" },
    });
    return "ok" as const;
  });

  if (result === "lost-race") {
    await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Item sold to another buyer before payment completed" } });
    await getStripe()?.refunds.create({ payment_intent: paymentIntentId, reason: "duplicate" }, { idempotencyKey: `race-refund-${order.id}` });
    await db.refund.create({ data: { orderId: order.id, amountPence: order.totalPence, reason: "Item no longer available", status: "PENDING" } });
    await notify({ userId: order.buyerId, type: "ORDER_UPDATE", title: "Sorry – that item just sold", body: `Someone else bought it moments before you. You've been refunded ${formatPence(order.totalPence)} in full.`, url: `/orders/${order.id}` });
    return { status: "refunded-race" as const };
  }

  await orderEvent(order, `Order ${order.number} paid – ${formatPence(order.totalPence)}`);
  await notify({
    userId: order.sellerId,
    type: "ORDER_UPDATE",
    title: "You made a sale! 🎉",
    body: order.deliveryType === "IN_PERSON"
      ? `Order ${order.number}: arrange the handover in chat. Ask the buyer for their 6-digit code when you hand it over.`
      : `Order ${order.number}: please post it by ${addWorkingDays(now, settings.shipByWorkingDays).toLocaleDateString("en-GB")}. Your prepaid label is on the order page.`,
    url: `/orders/${order.id}`,
  });
  await notify({ userId: order.buyerId, type: "ORDER_UPDATE", title: `Order ${order.number} confirmed`, body: `Thanks! We've told the seller. You paid ${formatPence(order.totalPence)}.`, url: `/orders/${order.id}` });
  if (order.deliveryType === "HOME") {
    const { createLabelForOrder } = await import("@/lib/shipping");
    await createLabelForOrder(order.id).catch((e) => console.error("[label after payment]", e));
  }
  return { status: "paid" as const, orderId: order.id };
}

export async function handlePaymentFailed(paymentIntentId: string, reason: string) {
  const order = await db.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, select: { buyerId: true } });
  if (order) await recordPaymentFailure(order.buyerId, reason);
}

/** Buyer confirms all is well, or the 2-day window passes: release funds to the seller. */
export async function completeOrder(orderId: string, how: "buyer-confirmed" | "auto-release" | "support") {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new ActionError("Order not found.");
  if (order.status === "COMPLETED") return order;
  if (!["DELIVERED", "SHIPPED", "DISPUTED", "PAID"].includes(order.status)) throw new ActionError("This order can't be completed yet.");
  if (how === "auto-release" && order.status !== "DELIVERED") throw new ActionError("Not eligible for auto-release.");
  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    await releaseSale(tx, order);
    return tx.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED", completedAt: now, ...(how === "buyer-confirmed" ? { buyerConfirmedAt: now } : {}) },
    });
  });
  await orderEvent(order, how === "buyer-confirmed" ? "The buyer confirmed everything is OK – order complete" : "Order complete – funds released to the seller");
  await notify({ userId: order.sellerId, type: "ORDER_UPDATE", title: `Order ${order.number} complete`, body: "Your earnings for this order are now available in your wallet. Don't forget to leave a review.", url: `/orders/${order.id}` });
  await notify({ userId: order.buyerId, type: "REVIEW", title: "How did it go?", body: `Leave a review for order ${order.number}.`, url: `/orders/${order.id}#review` });
  return updated;
}

/** Cron: release funds 2 days after delivery when no problem was reported. */
export async function autoReleaseOrders(now = new Date()) {
  const due = await db.order.findMany({ where: { status: "DELIVERED", autoReleaseAt: { lte: now }, dispute: null }, select: { id: true } });
  for (const o of due) await completeOrder(o.id, "auto-release").catch((e) => console.error("[auto-release]", o.id, e));
  return { released: due.length };
}

/** Refunds part or all of an order through Stripe and records it in the ledger. */
export async function refundOrder(input: { orderId: string; amountPence: number; reason: string; initiatedById?: string | null; restock?: boolean }) {
  const order = await db.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
  if (!order || !order.stripePaymentIntentId || !order.paidAt) throw new ActionError("Only paid orders can be refunded.");
  if (order.status === "COMPLETED") throw new ActionError("Funds have already been released for this order. Use a manual adjustment.");
  const remaining = order.totalPence - order.refundedPence;
  if (input.amountPence <= 0 || input.amountPence > remaining) throw new ActionError(`Refunds must be between £0.01 and ${formatPence(remaining)}.`);
  const stripe = getStripe();
  if (!stripe) throw new ActionError("Payments aren't configured.");

  const refundRow = await db.refund.create({ data: { orderId: order.id, amountPence: input.amountPence, reason: input.reason, initiatedById: input.initiatedById ?? null } });
  const sr = await stripe.refunds.create(
    { payment_intent: order.stripePaymentIntentId, amount: input.amountPence, metadata: { orderId: order.id, refundId: refundRow.id } },
    { idempotencyKey: `refund-${refundRow.id}` },
  );
  const full = order.refundedPence + input.amountPence >= order.totalPence;
  await db.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: refundRow.id }, data: { stripeRefundId: sr.id, status: sr.status === "succeeded" ? "SUCCEEDED" : "PENDING" } });
    // A full refund removes all seller earnings; a partial refund comes out of them.
    await debitRefund(tx, order, full ? order.sellerEarningsPence : input.amountPence);
    await tx.order.update({ where: { id: order.id }, data: { refundedPence: { increment: input.amountPence }, ...(full ? { status: "REFUNDED" } : {}) } });
    if (full && input.restock) {
      await tx.listing.updateMany({ where: { id: { in: order.items.map((i) => i.listingId) }, status: "SOLD" }, data: { status: "ACTIVE", soldAt: null } });
    }
  });
  await orderEvent(order, `${full ? "Full" : "Partial"} refund of ${formatPence(input.amountPence)} issued`);
  await notify({ userId: order.buyerId, type: "ORDER_UPDATE", title: `Refund of ${formatPence(input.amountPence)}`, body: `We've refunded ${formatPence(input.amountPence)} for order ${order.number}. It usually reaches your account in 5–10 working days.`, url: `/orders/${order.id}` });
  await notify({ userId: order.sellerId, type: "ORDER_UPDATE", title: `Refund on order ${order.number}`, body: `${formatPence(input.amountPence)} was refunded to the buyer.`, url: `/orders/${order.id}` });
  return { full };
}

/** Cancels an order. Paid orders are refunded in full and the items go back on sale. */
export async function cancelOrder(input: { orderId: string; byUserId: string | null; reason: string; asStaff?: boolean }) {
  const order = await db.order.findUnique({ where: { id: input.orderId }, include: { items: true, shipments: true } });
  if (!order) throw new ActionError("Order not found.");
  const isSeller = order.sellerId === input.byUserId;
  const isBuyer = order.buyerId === input.byUserId;
  if (!input.asStaff && !isSeller && !isBuyer) throw new ActionError("Order not found.");

  if (order.status === "PENDING_PAYMENT") {
    if (!isBuyer && !input.asStaff) throw new ActionError("Only the buyer can cancel an unpaid checkout.");
    await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: input.reason } });
    if (order.stripePaymentIntentId) await getStripe()?.paymentIntents.cancel(order.stripePaymentIntentId).catch(() => {});
    return;
  }
  if (order.status !== "PAID") throw new ActionError("Orders can only be cancelled before they're posted.");
  if (isBuyer && !input.asStaff) throw new ActionError("Ask the seller to cancel, or wait – if they don't post in time the order is cancelled automatically.");

  await refundOrder({ orderId: order.id, amountPence: order.totalPence - order.refundedPence, reason: `Cancelled: ${input.reason}`, initiatedById: input.byUserId, restock: true });
  await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: input.reason } });
  await orderEvent(order, `Order ${order.number} was cancelled – the buyer has been refunded in full`);
}

/** Cron: cancel orders the seller didn't post in time, and abandoned unpaid checkouts. */
export async function cancelOverdueOrders(now = new Date()) {
  const overdue = await db.order.findMany({ where: { status: "PAID", shipBy: { lt: now }, deliveryType: { not: "IN_PERSON" } }, select: { id: true, sellerId: true, number: true } });
  for (const o of overdue) {
    await cancelOrder({ orderId: o.id, byUserId: null, reason: "Not posted in time", asStaff: true }).catch((e) => console.error("[overdue]", o.id, e));
    await notify({ userId: o.sellerId, type: "ORDER_UPDATE", title: `Order ${o.number} cancelled`, body: "It wasn't posted in time, so the buyer has been refunded.", url: `/orders/${o.id}` });
  }
  const abandoned = await db.order.updateMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Checkout abandoned" },
  });
  return { overdue: overdue.length, abandoned: abandoned.count };
}
