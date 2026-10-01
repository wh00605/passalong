"use server";
import { z } from "zod";
import { safeAction } from "@/lib/action";
import { requireUserForAction } from "@/lib/session";
import { sendMemberMessage, markConversationRead } from "@/lib/messaging";
import { makeOffer, respondToOffer } from "@/lib/offers";
import { parsePounds } from "@/lib/money";
import { ActionError } from "@/lib/errors";

export async function sendMessageAction(conversationId: string, body: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const input = z.object({ conversationId: z.string().min(1).max(40), body: z.string().max(2000) }).parse({ conversationId, body });
    const { message, safetyWarning } = await sendMemberMessage({ conversationId: input.conversationId, senderId: me.id, body: input.body });
    return { id: message.id, safetyWarning };
  });
}

export async function makeOfferAction(input: { conversationId: string; amount: string; counterOfId?: string; listingIds?: string[] }) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const d = z
      .object({ conversationId: z.string().min(1).max(40), amount: z.string().max(12), counterOfId: z.string().max(40).optional(), listingIds: z.array(z.string().max(40)).max(20).optional() })
      .parse(input);
    const pence = parsePounds(d.amount);
    if (pence == null) throw new ActionError("Enter an amount like 15 or 15.50.");
    const offer = await makeOffer({ conversationId: d.conversationId, userId: me.id, amountPence: pence, counterOfId: d.counterOfId, listingIds: d.listingIds });
    return { id: offer.id };
  });
}

export async function respondToOfferAction(offerId: string, response: "accept" | "decline" | "withdraw") {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const d = z.object({ offerId: z.string().min(1).max(40), response: z.enum(["accept", "decline", "withdraw"]) }).parse({ offerId, response });
    await respondToOffer({ offerId: d.offerId, userId: me.id, response: d.response });
  });
}

export async function markReadAction(conversationId: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await markConversationRead(z.string().max(40).parse(conversationId), me.id);
  });
}
