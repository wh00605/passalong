import "server-only";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { minimumOffer } from "@/lib/fees";
import { formatPence } from "@/lib/money";
import { insertMessage } from "@/lib/messaging";
import { notify } from "@/lib/notify";
import { isBlockedBetween } from "@/lib/blocks";

async function loadConversation(conversationId: string, userId: string) {
  const c = await db.conversation.findUnique({ where: { id: conversationId }, include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } });
  if (!c || (c.buyerId !== userId && c.sellerId !== userId)) throw new ActionError("Conversation not found.");
  return c;
}

async function availableListings(listingIds: string[], sellerId: string, buyerId: string) {
  const listings = await db.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, title: true, pricePence: true, status: true, sellerId: true, reservedForId: true, moderationStatus: true } });
  if (listings.length !== listingIds.length || listings.length === 0) throw new ActionError("One of these items isn't available any more.");
  for (const l of listings) {
    const ok = l.sellerId === sellerId && l.moderationStatus === "OK" && (l.status === "ACTIVE" || (l.status === "RESERVED" && l.reservedForId === buyerId));
    if (!ok) throw new ActionError(`“${l.title}” isn't available any more.`);
  }
  return listings;
}

/**
 * Buyer makes an offer, or either party counters the other's pending offer.
 * Rules: amount between the minimum (a % of list price) and the list price; one pending offer at a time.
 */
export async function makeOffer(input: { conversationId: string; userId: string; amountPence: number; listingIds?: string[]; counterOfId?: string }) {
  const s = await getSettings();
  const c = await loadConversation(input.conversationId, input.userId);
  if (await isBlockedBetween(c.buyerId, c.sellerId)) throw new ActionError("You can't make offers with this member.");
  const isBuyer = c.buyerId === input.userId;

  let parent = null;
  if (input.counterOfId) {
    parent = await db.offer.findFirst({ where: { id: input.counterOfId, conversationId: c.id }, include: { items: true } });
    if (!parent || parent.status !== "PENDING" || parent.expiresAt < new Date()) throw new ActionError("That offer is no longer open.");
    if (parent.createdById === input.userId) throw new ActionError("You can't counter your own offer.");
  } else if (!isBuyer) {
    throw new ActionError("Only the buyer can start an offer. You can counter an offer you receive.");
  }

  const listingIds = parent ? parent.items.map((i) => i.listingId) : input.listingIds?.length ? input.listingIds : c.listingId ? [c.listingId] : [];
  const listings = await availableListings([...new Set(listingIds)], c.sellerId, c.buyerId);
  const listTotal = listings.reduce((a, l) => a + l.pricePence, 0);
  const min = minimumOffer(listTotal, s.minOfferPercent);
  if (!Number.isInteger(input.amountPence) || input.amountPence < min) throw new ActionError(`Offers need to be at least ${formatPence(min)} (${s.minOfferPercent}% of the price).`);
  if (input.amountPence >= listTotal) throw new ActionError(`That's the full price (${formatPence(listTotal)}) – you can just buy it.`);

  const offer = await db.$transaction(async (tx) => {
    // Supersede any other open offer in this conversation.
    await tx.offer.updateMany({
      where: { conversationId: c.id, status: "PENDING", id: { not: parent?.id ?? "" } },
      data: { status: "WITHDRAWN", respondedAt: new Date() },
    });
    if (parent) await tx.offer.update({ where: { id: parent.id }, data: { status: "COUNTERED", respondedAt: new Date() } });
    return tx.offer.create({
      data: {
        conversationId: c.id,
        buyerId: c.buyerId,
        sellerId: c.sellerId,
        createdById: input.userId,
        parentOfferId: parent?.id,
        amountPence: input.amountPence,
        expiresAt: new Date(Date.now() + s.offerExpiryHours * 3600_000),
        items: { create: listings.map((l) => ({ listingId: l.id })) },
      },
    });
  });

  const who = isBuyer ? c.buyer.name : c.seller.name;
  const verb = parent ? "countered with" : "offered";
  await insertMessage({ conversationId: c.id, senderId: input.userId, type: "OFFER", offerId: offer.id, body: `${who} ${verb} ${formatPence(offer.amountPence)}` });
  await notify({
    userId: isBuyer ? c.sellerId : c.buyerId,
    type: "OFFER",
    title: parent ? `Counter-offer: ${formatPence(offer.amountPence)}` : `New offer: ${formatPence(offer.amountPence)}`,
    body: `${who} ${verb} ${formatPence(offer.amountPence)}${listings.length > 1 ? ` for ${listings.length} items` : ` for “${listings[0].title}”`}. It expires in ${s.offerExpiryHours} hours.`,
    url: `/inbox/${c.id}`,
  });
  return offer;
}

export async function respondToOffer(input: { offerId: string; userId: string; response: "accept" | "decline" | "withdraw" }) {
  const s = await getSettings();
  const offer = await db.offer.findUnique({ where: { id: input.offerId }, include: { conversation: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } }, items: true } });
  if (!offer || (offer.buyerId !== input.userId && offer.sellerId !== input.userId)) throw new ActionError("Offer not found.");
  if (offer.status !== "PENDING") throw new ActionError("This offer is no longer open.");
  if (offer.expiresAt < new Date()) {
    await db.offer.update({ where: { id: offer.id }, data: { status: "EXPIRED" } });
    throw new ActionError("This offer has expired.");
  }
  const isCreator = offer.createdById === input.userId;
  if (input.response === "withdraw" && !isCreator) throw new ActionError("Only the person who made the offer can withdraw it.");
  if (input.response !== "withdraw" && isCreator) throw new ActionError("You can't respond to your own offer.");

  if (input.response === "accept") {
    await availableListings(offer.items.map((i) => i.listingId), offer.sellerId, offer.buyerId);
  }

  const status = input.response === "accept" ? "ACCEPTED" : input.response === "decline" ? "DECLINED" : "WITHDRAWN";
  const updated = await db.offer.update({
    where: { id: offer.id },
    data: {
      status,
      respondedAt: new Date(),
      // An accepted offer gives the buyer time to pay at that price.
      ...(status === "ACCEPTED" ? { expiresAt: new Date(Date.now() + s.offerExpiryHours * 3600_000) } : {}),
    },
  });

  const actor = input.userId === offer.buyerId ? offer.conversation.buyer.name : offer.conversation.seller.name;
  const text =
    status === "ACCEPTED" ? `${actor} accepted the offer of ${formatPence(offer.amountPence)}` :
    status === "DECLINED" ? `${actor} declined the offer of ${formatPence(offer.amountPence)}` :
    `${actor} withdrew the offer of ${formatPence(offer.amountPence)}`;
  await insertMessage({ conversationId: offer.conversationId, senderId: null, type: "SYSTEM", offerId: offer.id, body: text });
  const other = input.userId === offer.buyerId ? offer.sellerId : offer.buyerId;
  await notify({
    userId: other,
    type: "OFFER",
    title: status === "ACCEPTED" ? "Offer accepted!" : status === "DECLINED" ? "Offer declined" : "Offer withdrawn",
    body: status === "ACCEPTED" && other === offer.buyerId ? `${text}. Buy now at that price – the offer is held for ${s.offerExpiryHours} hours.` : text,
    url: `/inbox/${offer.conversationId}`,
  });
  return updated;
}

/** Cron: pending offers past their deadline, and accepted offers never paid for, expire. */
export async function expireOffers(now = new Date()) {
  const due = await db.offer.findMany({ where: { status: { in: ["PENDING", "ACCEPTED"] }, expiresAt: { lt: now } }, select: { id: true, conversationId: true, amountPence: true, status: true } });
  for (const o of due) {
    await db.offer.update({ where: { id: o.id }, data: { status: "EXPIRED" } });
    await insertMessage({ conversationId: o.conversationId, senderId: null, type: "SYSTEM", offerId: o.id, body: `The ${o.status === "ACCEPTED" ? "accepted " : ""}offer of ${formatPence(o.amountPence)} expired` });
  }
  return { expired: due.length };
}
