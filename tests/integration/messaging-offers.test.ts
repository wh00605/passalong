import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { startConversation, sendMemberMessage } from "@/lib/messaging";
import { makeOffer, respondToOffer, expireOffers } from "@/lib/offers";
import { createListing, createUser } from "../helpers/factories";

let buyer: Awaited<ReturnType<typeof createUser>>;
let seller: Awaited<ReturnType<typeof createUser>>;
let listing: Awaited<ReturnType<typeof createListing>>;
let convId: string;

beforeEach(async () => {
  buyer = await createUser();
  seller = await createUser();
  listing = await createListing(seller.id, { pricePence: 5000 });
  convId = (await startConversation(buyer.id, listing.id)).id;
});

describe("conversations", () => {
  it("reuses one conversation per item and buyer", async () => {
    const again = await startConversation(buyer.id, listing.id);
    expect(again.id).toBe(convId);
  });

  it("refuses to open a chat on your own item", async () => {
    await expect(startConversation(seller.id, listing.id)).rejects.toThrow("your own item");
  });

  it("blocks messaging between blocked members", async () => {
    await db.block.create({ data: { blockerId: seller.id, blockedId: buyer.id } });
    await expect(sendMemberMessage({ conversationId: convId, senderId: buyer.id, body: "hello" })).rejects.toThrow("can't message");
  });

  it("only lets participants send messages", async () => {
    const stranger = await createUser();
    await expect(sendMemberMessage({ conversationId: convId, senderId: stranger.id, body: "hi" })).rejects.toThrow("not found");
  });

  it("flags off-platform payment requests and notifies the recipient", async () => {
    const { safetyWarning } = await sendMemberMessage({ conversationId: convId, senderId: seller.id, body: "Just send it via PayPal friends and family" });
    expect(safetyWarning).toBe(true);
    const msg = await db.message.findFirstOrThrow({ where: { conversationId: convId } });
    expect(msg.safetyWarning).toBe(true);
    expect(await db.notification.count({ where: { userId: buyer.id, type: "MESSAGE" } })).toBe(1);
  });

  it("raises an off-platform fraud signal after repeated attempts", async () => {
    for (let i = 0; i < 3; i++) await sendMemberMessage({ conversationId: convId, senderId: seller.id, body: `bank transfer please ${i}` });
    expect(await db.fraudSignal.count({ where: { userId: seller.id, type: "OFF_PLATFORM" } })).toBe(1);
  });
});

describe("offers", () => {
  it("enforces the minimum offer (60%)", async () => {
    await expect(makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 2999 })).rejects.toThrow("at least £30.00");
  });

  it("rejects offers at or above the asking price", async () => {
    await expect(makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 5000 })).rejects.toThrow("full price");
  });

  it("does not let the seller start an offer", async () => {
    await expect(makeOffer({ conversationId: convId, userId: seller.id, amountPence: 4000 })).rejects.toThrow("Only the buyer");
  });

  it("supports offer → counter → accept", async () => {
    const o1 = await makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 3500 });
    await expect(respondToOffer({ offerId: o1.id, userId: buyer.id, response: "accept" })).rejects.toThrow("your own offer");

    const o2 = await makeOffer({ conversationId: convId, userId: seller.id, amountPence: 4200, counterOfId: o1.id });
    expect((await db.offer.findUniqueOrThrow({ where: { id: o1.id } })).status).toBe("COUNTERED");
    expect(o2.parentOfferId).toBe(o1.id);

    const accepted = await respondToOffer({ offerId: o2.id, userId: buyer.id, response: "accept" });
    expect(accepted.status).toBe("ACCEPTED");
    const msgs = await db.message.findMany({ where: { conversationId: convId }, orderBy: { createdAt: "asc" } });
    expect(msgs.map((m) => m.type)).toEqual(["OFFER", "OFFER", "SYSTEM"]);
    // The buyer accepted the seller's counter, so the seller is told.
    expect(await db.notification.count({ where: { userId: seller.id, type: "OFFER", title: "Offer accepted!" } })).toBe(1);
  });

  it("lets the buyer withdraw and the seller decline", async () => {
    const o1 = await makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 3500 });
    expect((await respondToOffer({ offerId: o1.id, userId: buyer.id, response: "withdraw" })).status).toBe("WITHDRAWN");
    const o2 = await makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 3600 });
    expect((await respondToOffer({ offerId: o2.id, userId: seller.id, response: "decline" })).status).toBe("DECLINED");
  });

  it("keeps only one pending offer per conversation", async () => {
    const o1 = await makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 3500 });
    await makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 3800 });
    expect((await db.offer.findUniqueOrThrow({ where: { id: o1.id } })).status).toBe("WITHDRAWN");
    expect(await db.offer.count({ where: { conversationId: convId, status: "PENDING" } })).toBe(1);
  });

  it("won't accept once the item has sold", async () => {
    const o1 = await makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 3500 });
    await db.listing.update({ where: { id: listing.id }, data: { status: "SOLD" } });
    await expect(respondToOffer({ offerId: o1.id, userId: seller.id, response: "accept" })).rejects.toThrow("isn't available");
  });

  it("expires stale offers", async () => {
    const o1 = await makeOffer({ conversationId: convId, userId: buyer.id, amountPence: 3500 });
    await db.offer.update({ where: { id: o1.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expireOffers();
    expect((await db.offer.findUniqueOrThrow({ where: { id: o1.id } })).status).toBe("EXPIRED");
  });
});
