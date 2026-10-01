import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCheckoutOrder, setDelivery, preparePayment, handlePaymentSucceeded, completeOrder, autoReleaseOrders, cancelOrder, refundOrder, cancelOverdueOrders } from "@/lib/orders";
import { getBalances } from "@/lib/wallet";
import { markDelivered } from "@/lib/shipping";
import { withdraw } from "@/lib/payouts";
import { startConversation } from "@/lib/messaging";
import { makeOffer, respondToOffer } from "@/lib/offers";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { fakeStripe, stripeCalls } from "../helpers/stripe-mock";
import { createListing, createUser } from "../helpers/factories";

vi.mock("@/lib/stripe", async () => (await import("../helpers/stripe-mock")).stripeModule());

let buyer: Awaited<ReturnType<typeof createUser>>;
let seller: Awaited<ReturnType<typeof createUser>>;

async function addressFor(userId: string) {
  return db.address.create({ data: { userId, fullName: "Test Person", line1: "1 High Street", city: "Leeds", postcode: "LS1 1AA", isDefault: true } });
}

/** Creates an order, chooses home delivery and creates a payment intent. */
async function checkout(listingIds: string[], offerId?: string) {
  const order = await createCheckoutOrder({ buyerId: buyer.id, listingIds, offerId });
  const addr = await db.address.findFirstOrThrow({ where: { userId: buyer.id } });
  await setDelivery({ orderId: order.id, buyerId: buyer.id, deliveryType: "HOME", addressId: addr.id });
  await preparePayment(order.id, buyer.id);
  return db.order.findUniqueOrThrow({ where: { id: order.id } });
}

async function pay(orderId: string) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  return handlePaymentSucceeded(o.stripePaymentIntentId!, "ch_test");
}

beforeEach(async () => {
  stripeCalls.length = 0;
  buyer = await createUser();
  seller = await createUser();
  await addressFor(buyer.id);
  await addressFor(seller.id);
});

describe("checkout and payment", () => {
  it("prices the order with postage and Buyer Protection, and creates a PaymentIntent for the exact total", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    expect(order.itemsSubtotalPence).toBe(2000);
    expect(order.shippingPence).toBe(299);
    expect(order.buyerProtectionFeePence).toBe(75 + 100);
    expect(order.totalPence).toBe(2000 + 299 + 175);
    const pi = stripeCalls.find((c) => c.method === "paymentIntents.create")!.args[0] as { amount: number; currency: string; metadata: Record<string, string> };
    expect(pi.amount).toBe(order.totalPence);
    expect(pi.currency).toBe("gbp");
    expect(pi.metadata.orderId).toBe(order.id);
  });

  it("removes postage for in-person handover", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await createCheckoutOrder({ buyerId: buyer.id, listingIds: [l.id] });
    const updated = await setDelivery({ orderId: order.id, buyerId: buyer.id, deliveryType: "IN_PERSON" });
    expect(updated.shippingPence).toBe(0);
    expect(updated.totalPence).toBe(2175);
  });

  it("marks items sold, credits pending earnings and is idempotent", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    expect((await pay(order.id)).status).toBe("paid");
    expect((await pay(order.id)).status).toBe("already-processed");
    expect((await db.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("SOLD");
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("PAID");
    expect(o.shipBy).not.toBeNull();
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 2000, availablePence: 0 });
  });

  it("refunds automatically if another buyer won the race", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    await db.listing.update({ where: { id: l.id }, data: { status: "SOLD" } });
    expect((await pay(order.id)).status).toBe("refunded-race");
    expect(stripeCalls.some((c) => c.method === "refunds.create")).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 0, availablePence: 0 });
  });

  it("blocks a second buyer while someone is mid-checkout", async () => {
    const l = await createListing(seller.id);
    await checkout([l.id]);
    const other = await createUser();
    await expect(createCheckoutOrder({ buyerId: other.id, listingIds: [l.id] })).rejects.toThrow("checking out");
  });

  it("won't sell a reserved item to someone else, or let you buy your own item", async () => {
    const l = await createListing(seller.id, { status: "RESERVED" });
    await expect(createCheckoutOrder({ buyerId: buyer.id, listingIds: [l.id] })).rejects.toThrow("isn't available");
    await db.listing.update({ where: { id: l.id }, data: { reservedForId: buyer.id } });
    await expect(createCheckoutOrder({ buyerId: buyer.id, listingIds: [l.id] })).resolves.toBeTruthy();
    const own = await createListing(buyer.id);
    await expect(createCheckoutOrder({ buyerId: buyer.id, listingIds: [own.id] })).rejects.toThrow("your own item");
  });
});

describe("bundles and offers", () => {
  it("applies the seller's bundle discount and charges postage once", async () => {
    await db.user.update({ where: { id: seller.id }, data: { bundleDiscountsEnabled: true, bundleTiers: { create: [{ minItems: 2, percentOff: 10 }] } } });
    const a = await createListing(seller.id, { pricePence: 2000 });
    const b = await createListing(seller.id, { pricePence: 1000 });
    const order = await checkout([a.id, b.id]);
    expect(order.bundleDiscountPence).toBe(300);
    expect(order.shippingPence).toBe(299);
    expect(order.sellerEarningsPence).toBe(2700);
  });

  it("refuses bundles across sellers", async () => {
    const a = await createListing(seller.id);
    const other = await createUser();
    const b = await createListing(other.id);
    await expect(createCheckoutOrder({ buyerId: buyer.id, listingIds: [a.id, b.id] })).rejects.toThrow("one seller");
  });

  it("charges the accepted offer price and marks the offer used", async () => {
    const l = await createListing(seller.id, { pricePence: 5000 });
    const conv = await startConversation(buyer.id, l.id);
    const offer = await makeOffer({ conversationId: conv.id, userId: buyer.id, amountPence: 4000 });
    await respondToOffer({ offerId: offer.id, userId: seller.id, response: "accept" });
    const order = await checkout([], offer.id);
    expect(order.itemsSubtotalPence - order.bundleDiscountPence).toBe(4000);
    expect(order.buyerProtectionFeePence).toBe(75 + 200);
    await pay(order.id);
    expect((await db.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe("USED");
  });
});

describe("funds release and wallet", () => {
  it("releases funds when the buyer confirms", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    await pay(order.id);
    await markDelivered(order.id);
    await completeOrder(order.id, "buyer-confirmed");
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 0, availablePence: 2000 });
  });

  it("auto-releases 2 days after delivery, not before", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    await pay(order.id);
    await markDelivered(order.id);
    await autoReleaseOrders(new Date(Date.now() + 86_400_000));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DELIVERED");
    await autoReleaseOrders(new Date(Date.now() + 2 * 86_400_000 + 60_000));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("COMPLETED");
  });

  it("withdraws available funds via Stripe Connect and blocks overdrawing", async () => {
    await db.user.update({ where: { id: seller.id }, data: { stripeAccountId: `acct_${seller.id.slice(0, 8)}`, stripePayoutsEnabled: true } });
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    await pay(order.id);
    await markDelivered(order.id);
    await completeOrder(order.id, "buyer-confirmed");
    await expect(withdraw(seller.id, 2001)).rejects.toThrow("up to £20.00");
    const payout = await withdraw(seller.id, 1500);
    expect(payout.status).toBe("IN_TRANSIT");
    expect(stripeCalls.some((c) => c.method === "transfers.create")).toBe(true);
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 0, availablePence: 500 });
  });
});

describe("refunds and cancellations", () => {
  it("seller cancellation refunds in full and puts the item back on sale", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    await pay(order.id);
    await cancelOrder({ orderId: order.id, byUserId: seller.id, reason: "Damaged it while packing" });
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("CANCELLED");
    expect(o.refundedPence).toBe(o.totalPence);
    expect((await db.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("ACTIVE");
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 0, availablePence: 0 });
  });

  it("partial refunds come out of the seller's held earnings", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    await pay(order.id);
    await refundOrder({ orderId: order.id, amountPence: 500, reason: "Small mark" });
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 1500, availablePence: 0 });
    await expect(refundOrder({ orderId: order.id, amountPence: 999_999, reason: "too much" })).rejects.toThrow("between");
  });

  it("auto-cancels orders not posted in time", async () => {
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    await pay(order.id);
    await db.order.update({ where: { id: order.id }, data: { shipBy: new Date(Date.now() - 1000) } });
    await cancelOverdueOrders();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });
});

describe("Stripe webhook", () => {
  const secret = "whsec_test_secret";
  async function send(event: object, sig?: string) {
    const payload = JSON.stringify(event);
    const header = sig ?? fakeStripe.webhooks.generateTestHeaderString({ payload, secret });
    return stripeWebhook(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
  }

  it("rejects events with a bad signature", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const res = await send({ id: "evt_bad", type: "payment_intent.succeeded", data: { object: {} } }, "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
  });

  it("processes a signed payment_intent.succeeded once", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const l = await createListing(seller.id, { pricePence: 2000 });
    const order = await checkout([l.id]);
    const event = { id: `evt_${order.id}`, object: "event", type: "payment_intent.succeeded", data: { object: { id: order.stripePaymentIntentId, object: "payment_intent", latest_charge: "ch_1", metadata: { kind: "order", orderId: order.id } } } };
    const r1 = await send(event);
    expect(r1.status).toBe(200);
    expect((await r1.json()).duplicate).toBe(false);
    const r2 = await send(event);
    expect((await r2.json()).duplicate).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });
});
