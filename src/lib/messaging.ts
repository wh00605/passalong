import "server-only";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { isBlockedBetween } from "@/lib/blocks";
import { looksOffPlatform, containsExternalLink, raiseSignal } from "@/lib/fraud";
import { notify } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit";
import { pingChannel, conversationChannel, userChannel } from "@/lib/realtime";
import type { MessageType } from "@/generated/prisma/enums";

export const SAFETY_WARNING =
  "For your safety, keep payments and conversations on Passalong. Payments made outside Passalong aren't covered by Buyer Protection, and requests to pay by bank transfer, PayPal Friends & Family or similar are a common scam.";

export async function getConversationFor(conversationId: string, userId: string) {
  const c = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { id: true, title: true, pricePence: true, status: true, sellerId: true, reservedForId: true, photos: { orderBy: { position: "asc" }, take: 1 } } },
      buyer: { select: { id: true, name: true, username: true, image: true, deletedAt: true, lastActiveAt: true, showOnlineStatus: true } },
      seller: { select: { id: true, name: true, username: true, image: true, deletedAt: true, lastActiveAt: true, showOnlineStatus: true } },
    },
  });
  if (!c || (c.buyerId !== userId && c.sellerId !== userId)) return null;
  return c;
}

/** Finds or creates the buyer↔seller conversation for a listing. */
export async function startConversation(buyerId: string, listingId: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, sellerId: true, status: true, moderationStatus: true } });
  if (!listing || listing.moderationStatus !== "OK" || ["DRAFT", "DELETED", "REMOVED"].includes(listing.status)) {
    throw new ActionError("This item isn't available.");
  }
  if (listing.sellerId === buyerId) throw new ActionError("This is your own item.");
  if (await isBlockedBetween(buyerId, listing.sellerId)) throw new ActionError("You can't message this member.");
  return db.conversation.upsert({
    where: { listingId_buyerId: { listingId, buyerId } },
    create: { listingId, buyerId, sellerId: listing.sellerId, lastMessageAt: new Date(0) },
    update: {},
  });
}

type SendInput = {
  conversationId: string;
  senderId: string | null;
  body: string;
  type?: MessageType;
  offerId?: string;
  orderId?: string;
  attachments?: { storageKey: string; width: number; height: number }[];
};

/** Low-level insert used for both member messages and system events. Updates ordering and pings clients. */
export async function insertMessage(input: SendInput) {
  const msg = await db.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: input.senderId,
      type: input.type ?? "TEXT",
      body: input.body,
      offerId: input.offerId,
      orderId: input.orderId,
      attachments: input.attachments?.length ? { create: input.attachments } : undefined,
    },
  });
  const conv = await db.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: msg.createdAt },
    select: { buyerId: true, sellerId: true },
  });
  await Promise.all([
    pingChannel(conversationChannel(input.conversationId)),
    pingChannel(userChannel(conv.buyerId)),
    pingChannel(userChannel(conv.sellerId)),
  ]);
  return msg;
}

/** Sends a member's chat message with blocking, spam and off-platform payment checks. */
export async function sendMemberMessage(input: { conversationId: string; senderId: string; body: string; attachments?: SendInput["attachments"] }) {
  const conv = await getConversationFor(input.conversationId, input.senderId);
  if (!conv) throw new ActionError("Conversation not found.");
  const otherId = conv.buyerId === input.senderId ? conv.sellerId : conv.buyerId;
  if (await isBlockedBetween(input.senderId, otherId)) throw new ActionError("You can't message this member.");
  const other = conv.buyerId === input.senderId ? conv.seller : conv.buyer;
  if (other.deletedAt) throw new ActionError("This member has left Passalong.");

  const body = input.body.trim().slice(0, 2000);
  if (!body && !input.attachments?.length) throw new ActionError("Write a message first.");

  // Spam: burst limit, plus the same text pasted into many conversations.
  if (!(await checkRateLimit(`msg:${input.senderId}`, 30, 60))) {
    await raiseSignal(input.senderId, "SPAM", 10, { reason: "message burst" });
    throw new ActionError("You're sending messages too quickly. Please slow down.");
  }
  if (body.length > 20) {
    const dupes = await db.message.groupBy({
      by: ["conversationId"],
      where: { senderId: input.senderId, body, createdAt: { gt: new Date(Date.now() - 3600_000) } },
    });
    if (dupes.length >= 8) {
      await raiseSignal(input.senderId, "SPAM", 20, { reason: "same message in many conversations", conversations: dupes.length });
      throw new ActionError("This looks like spam, so it wasn't sent.");
    }
  }

  const offPlatform = looksOffPlatform(body) || containsExternalLink(body);
  const msg = await insertMessage({ conversationId: conv.id, senderId: input.senderId, body, type: input.attachments?.length ? "IMAGE" : "TEXT", attachments: input.attachments });
  if (offPlatform) await db.message.update({ where: { id: msg.id }, data: { safetyWarning: true } });
  if (offPlatform) {
    const count = await db.message.count({ where: { senderId: input.senderId, safetyWarning: true, createdAt: { gt: new Date(Date.now() - 30 * 86_400_000) } } });
    if (count >= 3) await raiseSignal(input.senderId, "OFF_PLATFORM", 15 * count, { flaggedMessages: count });
  }

  // Mark as read for the sender, update seller response time.
  const isSeller = conv.sellerId === input.senderId;
  await db.conversation.update({ where: { id: conv.id }, data: isSeller ? { sellerLastReadAt: new Date() } : { buyerLastReadAt: new Date() } });
  if (isSeller) await updateResponseTime(conv.id, input.senderId);

  // Email at most once per 15 minutes per conversation; in-app/push every time.
  const recent = await db.notification.findFirst({
    where: { userId: otherId, type: "MESSAGE", url: `/inbox/${conv.id}`, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } },
  });
  const sender = conv.buyerId === input.senderId ? conv.buyer : conv.seller;
  await notify({
    userId: otherId,
    type: "MESSAGE",
    title: `New message from ${sender.name}`,
    body: input.attachments?.length && !body ? "Sent a photo" : body.slice(0, 140),
    url: `/inbox/${conv.id}`,
    skipEmail: !!recent,
  });
  return { message: msg, safetyWarning: offPlatform };
}

/** Rolling average of how long the seller takes to reply to a buyer's first unanswered message. */
async function updateResponseTime(conversationId: string, sellerId: string) {
  const lastTwo = await db.message.findMany({
    where: { conversationId, type: { in: ["TEXT", "IMAGE"] } },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { senderId: true, createdAt: true },
  });
  if (lastTwo.length < 2 || lastTwo[1].senderId === sellerId) return;
  const minutes = Math.max(1, Math.round((lastTwo[0].createdAt.getTime() - lastTwo[1].createdAt.getTime()) / 60_000));
  const u = await db.user.findUnique({ where: { id: sellerId }, select: { avgResponseMinutes: true } });
  const avg = u?.avgResponseMinutes == null ? minutes : Math.round(u.avgResponseMinutes * 0.8 + minutes * 0.2);
  await db.user.update({ where: { id: sellerId }, data: { avgResponseMinutes: avg } });
}

export async function markConversationRead(conversationId: string, userId: string) {
  const c = await db.conversation.findUnique({ where: { id: conversationId }, select: { buyerId: true, sellerId: true } });
  if (!c) return;
  if (c.buyerId === userId) await db.conversation.update({ where: { id: conversationId }, data: { buyerLastReadAt: new Date() } });
  else if (c.sellerId === userId) await db.conversation.update({ where: { id: conversationId }, data: { sellerLastReadAt: new Date() } });
}

export const messageSelect = {
  id: true,
  senderId: true,
  type: true,
  body: true,
  safetyWarning: true,
  hiddenAt: true,
  createdAt: true,
  attachments: { select: { id: true, storageKey: true, width: true, height: true } },
  offer: { select: { id: true, amountPence: true, status: true, createdById: true, expiresAt: true, items: { select: { listingId: true } } } },
  order: { select: { id: true, number: true, status: true } },
} as const;
