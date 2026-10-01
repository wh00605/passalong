import "server-only";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { addDays } from "@/lib/time";
import { formatPence } from "@/lib/money";
import { notify } from "@/lib/notify";
import { completeOrder, orderEvent, refundOrder } from "@/lib/orders";
import { createLabelForOrder } from "@/lib/shipping";
import type { DisputeReason, DisputeStatus } from "@/generated/prisma/enums";

export const REASON_LABELS: Record<DisputeReason, string> = {
  NOT_AS_DESCRIBED: "Not as described",
  DAMAGED: "Damaged",
  MISSING: "Missing or never arrived",
  COUNTERFEIT: "Counterfeit",
};

const OPEN: DisputeStatus[] = ["AWAITING_SELLER", "AWAITING_BUYER", "RETURN_REQUESTED", "RETURN_IN_TRANSIT", "RETURN_DELIVERED", "ESCALATED"];

async function event(disputeId: string, actorId: string | null, type: string, body = "") {
  await db.disputeEvent.create({ data: { disputeId, actorId, type, body } });
}

async function load(disputeId: string) {
  const d = await db.dispute.findUnique({ where: { id: disputeId }, include: { order: { include: { items: true } } } });
  if (!d) throw new ActionError("Case not found.");
  return d;
}

/** Buyer reports a problem within the window after delivery (or a parcel that never arrived). */
export async function openDispute(input: { orderId: string; buyerId: string; reason: DisputeReason; description: string }) {
  const s = await getSettings();
  const order = await db.order.findFirst({ where: { id: input.orderId, buyerId: input.buyerId }, include: { dispute: true, items: true } });
  if (!order) throw new ActionError("Order not found.");
  if (order.dispute) throw new ActionError("You've already reported a problem with this order.");
  const now = new Date();
  const inWindow = order.status === "DELIVERED" && order.deliveredAt && now.getTime() <= order.deliveredAt.getTime() + s.disputeWindowDays * 86_400_000;
  const notArrived = input.reason === "MISSING" && order.status === "SHIPPED" && order.shippedAt && now.getTime() > order.shippedAt.getTime() + 5 * 86_400_000;
  if (!inWindow && !notArrived) {
    throw new ActionError(
      order.status === "SHIPPED"
        ? "If your parcel hasn't arrived 5 days after it was sent, you can report it missing."
        : `Problems must be reported within ${s.disputeWindowDays} days of delivery.`,
    );
  }
  const description = input.description.trim();
  if (description.length < 10) throw new ActionError("Please describe the problem (at least 10 characters).");

  const dispute = await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: "DISPUTED", autoReleaseAt: null } });
    return tx.dispute.create({
      data: { orderId: order.id, openedById: input.buyerId, reason: input.reason, description: description.slice(0, 2000), sellerRespondBy: addDays(now, s.sellerDisputeResponseDays) },
    });
  });
  await event(dispute.id, input.buyerId, "OPENED", `${REASON_LABELS[input.reason]}: ${description.slice(0, 500)}`);
  await orderEvent(order, `The buyer reported a problem: ${REASON_LABELS[input.reason]}. Payment is on hold.`);
  await notify({
    userId: order.sellerId,
    type: "DISPUTE",
    title: `Problem reported on order ${order.number}`,
    body: `The buyer says: ${REASON_LABELS[input.reason]}. Please respond within ${s.sellerDisputeResponseDays} days or our team will step in.`,
    url: `/orders/${order.id}/dispute`,
  });
  return dispute;
}

export async function addEvidence(input: { disputeId: string; userId: string; note: string; storageKey?: string }) {
  const d = await load(input.disputeId);
  if (d.order.buyerId !== input.userId && d.order.sellerId !== input.userId) throw new ActionError("Case not found.");
  if (!OPEN.includes(d.status)) throw new ActionError("This case is closed.");
  if (!input.note.trim() && !input.storageKey) throw new ActionError("Add a photo or a note.");
  await db.disputeEvidence.create({ data: { disputeId: d.id, uploaderId: input.userId, note: input.note.trim().slice(0, 1000), storageKey: input.storageKey } });
  await event(d.id, input.userId, "EVIDENCE", input.storageKey ? "Added a photo" : input.note.slice(0, 200));
}

type SellerResponse = { kind: "accept_return" } | { kind: "refund_no_return" } | { kind: "offer_partial"; amountPence: number } | { kind: "escalate"; note: string };

/** Seller's options: take it back (return label), refund without return, offer a partial refund, or ask support. */
export async function sellerRespond(disputeId: string, sellerId: string, response: SellerResponse) {
  const d = await load(disputeId);
  if (d.order.sellerId !== sellerId) throw new ActionError("Case not found.");
  if (d.status !== "AWAITING_SELLER") throw new ActionError("You've already responded to this case.");

  switch (response.kind) {
    case "accept_return": {
      await db.dispute.update({ where: { id: d.id }, data: { status: "RETURN_REQUESTED" } });
      await event(d.id, sellerId, "RETURN_ACCEPTED", "Seller agreed to a return and full refund.");
      const label = await createLabelForOrder(d.orderId, "RETURN");
      await notify({
        userId: d.order.buyerId,
        type: "DISPUTE",
        title: "Return agreed",
        body: label ? "Post the item back with the prepaid return label on the order page. You'll be refunded when it arrives." : "Post the item back to the seller and add the tracking number on the case page. You'll be refunded when it arrives.",
        url: `/orders/${d.orderId}/dispute`,
      });
      break;
    }
    case "refund_no_return":
      await resolveWithRefund(d.id, sellerId, d.order.totalPence - d.order.refundedPence, "Seller refunded without needing the item back.");
      break;
    case "offer_partial": {
      const max = d.order.itemsSubtotalPence - d.order.bundleDiscountPence;
      if (!Number.isInteger(response.amountPence) || response.amountPence < 1 || response.amountPence >= max) {
        throw new ActionError(`A partial refund must be less than the item price (${formatPence(max)}).`);
      }
      await db.dispute.update({ where: { id: d.id }, data: { status: "AWAITING_BUYER", partialOfferPence: response.amountPence } });
      await event(d.id, sellerId, "PARTIAL_OFFERED", `Seller offered a partial refund of ${formatPence(response.amountPence)}.`);
      await notify({ userId: d.order.buyerId, type: "DISPUTE", title: `Partial refund offered: ${formatPence(response.amountPence)}`, body: "Accept it and keep the item, or ask our team to review the case.", url: `/orders/${d.orderId}/dispute` });
      break;
    }
    case "escalate":
      await escalate(d.id, sellerId, response.note || "Seller asked support to review.");
      break;
  }
}

export async function buyerRespondToPartial(disputeId: string, buyerId: string, accept: boolean) {
  const d = await load(disputeId);
  if (d.order.buyerId !== buyerId) throw new ActionError("Case not found.");
  if (d.status !== "AWAITING_BUYER" || !d.partialOfferPence) throw new ActionError("There's no offer to respond to.");
  if (!accept) return escalate(d.id, buyerId, "Buyer declined the partial refund.");
  await refundOrder({ orderId: d.orderId, amountPence: d.partialOfferPence, reason: "Partial refund agreed in dispute", initiatedById: buyerId });
  await db.dispute.update({ where: { id: d.id }, data: { status: "RESOLVED_PARTIAL_REFUND", resolvedAt: new Date(), resolutionNote: "Partial refund agreed" } });
  await event(d.id, buyerId, "RESOLVED", `Buyer accepted a partial refund of ${formatPence(d.partialOfferPence)}.`);
  await completeOrder(d.orderId, "support");
}

/** Buyer withdraws the problem (e.g. sorted it out with the seller). Funds are released. */
export async function buyerCloseDispute(disputeId: string, buyerId: string) {
  const d = await load(disputeId);
  if (d.order.buyerId !== buyerId) throw new ActionError("Case not found.");
  if (!["AWAITING_SELLER", "AWAITING_BUYER", "ESCALATED"].includes(d.status)) throw new ActionError("This case can't be closed now.");
  await db.dispute.update({ where: { id: d.id }, data: { status: "CANCELLED", resolvedAt: new Date(), resolutionNote: "Closed by buyer" } });
  await event(d.id, buyerId, "CLOSED", "Buyer closed the case – no problem any more.");
  await completeOrder(d.orderId, "support");
}

export async function escalate(disputeId: string, actorId: string | null, note: string) {
  const d = await load(disputeId);
  if (!OPEN.includes(d.status) || d.status === "ESCALATED") throw new ActionError("This case can't be escalated now.");
  await db.dispute.update({ where: { id: d.id }, data: { status: "ESCALATED", escalatedAt: new Date() } });
  await event(d.id, actorId, "ESCALATED", note.slice(0, 500));
  for (const uid of [d.order.buyerId, d.order.sellerId]) {
    await notify({ userId: uid, type: "DISPUTE", title: "Our team is reviewing your case", body: "We'll look at the evidence from both of you and decide within 3 working days.", url: `/orders/${d.orderId}/dispute` });
  }
}

async function resolveWithRefund(disputeId: string, actorId: string | null, amountPence: number, note: string) {
  const d = await load(disputeId);
  await refundOrder({ orderId: d.orderId, amountPence, reason: `Dispute: ${REASON_LABELS[d.reason]}`, initiatedById: actorId });
  await db.dispute.update({ where: { id: d.id }, data: { status: "RESOLVED_REFUND", resolvedAt: new Date(), resolvedById: actorId, resolutionNote: note } });
  await event(d.id, actorId, "RESOLVED", note);
}

/** Support decision on an escalated case. */
export async function staffResolve(disputeId: string, staffId: string, decision: { kind: "refund" } | { kind: "partial"; amountPence: number } | { kind: "release" }, note: string) {
  const d = await load(disputeId);
  if (!OPEN.includes(d.status)) throw new ActionError("This case is already closed.");
  if (decision.kind === "refund") {
    await resolveWithRefund(d.id, staffId, d.order.totalPence - d.order.refundedPence, `Support decision: full refund. ${note}`);
  } else if (decision.kind === "partial") {
    await refundOrder({ orderId: d.orderId, amountPence: decision.amountPence, reason: "Support decision: partial refund", initiatedById: staffId });
    await db.dispute.update({ where: { id: d.id }, data: { status: "RESOLVED_PARTIAL_REFUND", resolvedAt: new Date(), resolvedById: staffId, resolutionNote: note } });
    await event(d.id, staffId, "RESOLVED", `Support decision: partial refund of ${formatPence(decision.amountPence)}. ${note}`);
    await completeOrder(d.orderId, "support");
  } else {
    await db.dispute.update({ where: { id: d.id }, data: { status: "RESOLVED_RELEASED", resolvedAt: new Date(), resolvedById: staffId, resolutionNote: note } });
    await event(d.id, staffId, "RESOLVED", `Support decision: payment released to the seller. ${note}`);
    await completeOrder(d.orderId, "support");
  }
  for (const uid of [d.order.buyerId, d.order.sellerId]) {
    await notify({ userId: uid, type: "DISPUTE", title: "Your case has been decided", body: note.slice(0, 200) || "See the case page for details.", url: `/orders/${d.orderId}/dispute` });
  }
}

/** Return parcel delivered back to the seller → refund the buyer in full. */
export async function onReturnDelivered(orderId: string) {
  const d = await db.dispute.findUnique({ where: { orderId } });
  if (!d || !["RETURN_REQUESTED", "RETURN_IN_TRANSIT"].includes(d.status)) return;
  await db.dispute.update({ where: { id: d.id }, data: { status: "RETURN_DELIVERED" } });
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  await resolveWithRefund(d.id, null, order.totalPence - order.refundedPence, "Return received by the seller – buyer refunded in full.");
  // The item is back with the seller: hide it so they can check it and relist.
  await db.listing.updateMany({ where: { id: { in: order.items.map((i) => i.listingId) } }, data: { status: "HIDDEN", soldAt: null } });
}

/** Cron: escalate cases where the seller didn't respond in time. */
export async function escalateOverdueDisputes(now = new Date()) {
  const overdue = await db.dispute.findMany({ where: { status: "AWAITING_SELLER", sellerRespondBy: { lt: now } }, select: { id: true } });
  for (const d of overdue) await escalate(d.id, null, "The seller didn't respond in time.").catch(() => {});
  return { escalated: overdue.length };
}
