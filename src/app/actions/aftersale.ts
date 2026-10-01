"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { safeAction, validatedAction } from "@/lib/action";
import { requireUserForAction, ActionError } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parsePounds } from "@/lib/money";
import { openDispute, addEvidence, sellerRespond, buyerRespondToPartial, buyerCloseDispute, escalate } from "@/lib/disputes";
import { leaveReview } from "@/lib/reviews";
import { addManualTracking, bookCollection, createLabelForOrder } from "@/lib/shipping";
import { withdraw, connectOnboardingLink } from "@/lib/payouts";
import { startPromotion } from "@/lib/promotions";
import { processAndStoreImage, ImageError } from "@/lib/images";

const id = z.string().min(1).max(40);

export const openDisputeAction = validatedAction(
  z.object({
    orderId: id,
    reason: z.enum(["NOT_AS_DESCRIBED", "DAMAGED", "MISSING", "COUNTERFEIT"], { error: "Choose what's wrong." }),
    description: z.string().trim().min(10, "Describe the problem (at least 10 characters).").max(2000),
  }),
  async (d) => {
    const me = await requireUserForAction();
    await enforceRateLimit("dispute", me.id, 10, 3600);
    await openDispute({ orderId: d.orderId, buyerId: me.id, reason: d.reason, description: d.description });
    redirect(`/orders/${d.orderId}/dispute`);
  },
);

export const addEvidenceAction = validatedAction(z.object({ disputeId: id, note: z.string().trim().max(1000).default("") }), async (d, form) => {
  const me = await requireUserForAction();
  await enforceRateLimit("evidence", me.id, 30, 3600);
  let storageKey: string | undefined;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    try {
      storageKey = (await processAndStoreImage(Buffer.from(await file.arrayBuffer()), { prefix: `disputes/${d.disputeId}`, visibility: "private" })).storageKey;
    } catch (err) {
      if (err instanceof ImageError) throw new ActionError(err.message);
      throw err;
    }
  }
  await addEvidence({ disputeId: d.disputeId, userId: me.id, note: d.note, storageKey });
  revalidatePath("/orders/[id]/dispute", "page");
  return { ok: true, message: "Added to the case." };
});

export async function sellerRespondAction(disputeId: string, kind: "accept_return" | "refund_no_return" | "offer_partial" | "escalate", amount?: string, note?: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    if (kind === "offer_partial") {
      const pence = parsePounds(amount ?? "");
      if (pence == null) throw new ActionError("Enter an amount like 5 or 5.50.");
      await sellerRespond(id.parse(disputeId), me.id, { kind, amountPence: pence });
    } else if (kind === "escalate") {
      await sellerRespond(id.parse(disputeId), me.id, { kind, note: (note ?? "").slice(0, 500) });
    } else {
      await sellerRespond(id.parse(disputeId), me.id, { kind });
    }
    revalidatePath("/orders/[id]/dispute", "page");
  });
}

export async function buyerDisputeAction(disputeId: string, kind: "accept_partial" | "decline_partial" | "close" | "escalate") {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const dId = id.parse(disputeId);
    if (kind === "accept_partial" || kind === "decline_partial") await buyerRespondToPartial(dId, me.id, kind === "accept_partial");
    else if (kind === "close") await buyerCloseDispute(dId, me.id);
    else {
      const d = await db.dispute.findUnique({ where: { id: dId }, include: { order: true } });
      if (!d || d.order.buyerId !== me.id) throw new ActionError("Case not found.");
      if (d.status === "AWAITING_SELLER" && d.sellerRespondBy > new Date()) throw new ActionError("Give the seller until their deadline to respond first.");
      await escalate(dId, me.id, "Buyer asked support to review.");
    }
    revalidatePath("/orders/[id]/dispute", "page");
  });
}

export const leaveReviewAction = validatedAction(
  z.object({ orderId: id, rating: z.coerce.number().int().min(1, "Choose a star rating.").max(5), text: z.string().trim().max(1000).default("") }),
  async (d) => {
    const me = await requireUserForAction();
    await leaveReview({ orderId: d.orderId, authorId: me.id, rating: d.rating, text: d.text });
    revalidatePath(`/orders/${d.orderId}`);
    return { ok: true, message: "Thanks for your review!" };
  },
);

export const manualTrackingAction = validatedAction(
  z.object({ orderId: id, carrier: z.string().trim().min(2, "Which carrier?").max(40), trackingNumber: z.string().trim().min(5, "Enter the tracking number.").max(40).regex(/^[A-Za-z0-9 -]+$/, "Letters and numbers only.") }),
  async (d) => {
    const me = await requireUserForAction();
    await addManualTracking({ orderId: d.orderId, sellerId: me.id, carrier: d.carrier, trackingNumber: d.trackingNumber });
    revalidatePath(`/orders/${d.orderId}`);
    return { ok: true, message: "Marked as sent. We've told the buyer." };
  },
);

export async function retryLabelAction(orderId: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const order = await db.order.findFirst({ where: { id: id.parse(orderId), sellerId: me.id, status: "PAID" } });
    if (!order) throw new ActionError("Order not found.");
    await enforceRateLimit("label-retry", me.id, 10, 3600);
    await createLabelForOrder(order.id);
    revalidatePath(`/orders/${order.id}`);
  });
}

export async function bookCollectionAction(orderId: string, date: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const day = z.iso.date().parse(date);
    const res = await bookCollection({ orderId: id.parse(orderId), sellerId: me.id, date: new Date(`${day}T09:00:00Z`) });
    revalidatePath(`/orders/${orderId}`);
    return res;
  });
}

export async function withdrawAction(amount: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await enforceRateLimit("withdraw", me.id, 5, 3600);
    const pence = parsePounds(amount);
    if (pence == null) throw new ActionError("Enter an amount like 25 or 25.50.");
    await withdraw(me.id, pence);
    revalidatePath("/wallet");
  });
}

export async function payoutOnboardingAction() {
  const me = await requireUserForAction();
  const url = await connectOnboardingLink(me.id);
  redirect(url);
}

export async function startPromotionAction(type: "BUMP" | "WARDROBE_SPOTLIGHT", listingId?: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await enforceRateLimit("promotion", me.id, 20, 3600);
    return startPromotion({ userId: me.id, type: z.enum(["BUMP", "WARDROBE_SPOTLIGHT"]).parse(type), listingId: listingId ? id.parse(listingId) : undefined });
  });
}
