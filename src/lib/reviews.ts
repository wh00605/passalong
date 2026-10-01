import "server-only";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { checkListingContent } from "@/lib/moderation";

async function recomputeRating(userId: string) {
  const agg = await db.review.aggregate({ where: { subjectId: userId }, _avg: { rating: true }, _count: { _all: true } });
  await db.user.update({ where: { id: userId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
}

/** Two-way reviews: buyer reviews seller and seller reviews buyer, once each, after completion. */
export async function leaveReview(input: { orderId: string; authorId: string; rating: number; text: string }) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new ActionError("Choose 1 to 5 stars.");
  const text = input.text.trim().slice(0, 1000);
  const order = await db.order.findUnique({ where: { id: input.orderId } });
  if (!order || (order.buyerId !== input.authorId && order.sellerId !== input.authorId)) throw new ActionError("Order not found.");
  if (order.status !== "COMPLETED") throw new ActionError("You can leave a review once the order is complete.");
  const existing = await db.review.findUnique({ where: { orderId_authorId: { orderId: order.id, authorId: input.authorId } } });
  if (existing) throw new ActionError("You've already reviewed this order.");
  if (text) {
    const check = await checkListingContent({ title: "", description: text });
    if (check.blocked.length) throw new ActionError("Your review contains words we don't allow. Please edit it.");
  }
  const isBuyer = order.buyerId === input.authorId;
  const review = await db.review.create({
    data: { orderId: order.id, authorId: input.authorId, subjectId: isBuyer ? order.sellerId : order.buyerId, authorRole: isBuyer ? "BUYER" : "SELLER", rating: input.rating, text },
  });
  await recomputeRating(review.subjectId);
  await notify({ userId: review.subjectId, type: "REVIEW", title: `New ${input.rating}-star review`, body: text ? text.slice(0, 140) : "You received a new review.", url: `/orders/${order.id}` });
  return review;
}

/** Cron: if the buyer confirmed the order but didn't review within N days, leave automatic 5-star feedback. */
export async function autoFeedback(now = new Date()) {
  const s = await getSettings();
  const cutoff = new Date(now.getTime() - s.autoFeedbackDays * 86_400_000);
  const orders = await db.order.findMany({
    where: { status: "COMPLETED", buyerConfirmedAt: { lte: cutoff }, reviews: { none: { authorRole: "BUYER" } } },
    select: { id: true, buyerId: true, sellerId: true },
    take: 500,
  });
  for (const o of orders) {
    await db.review.create({ data: { orderId: o.id, authorId: o.buyerId, subjectId: o.sellerId, authorRole: "BUYER", rating: 5, text: "", isAutomatic: true } }).catch(() => {});
    await recomputeRating(o.sellerId);
  }
  return { created: orders.length };
}
