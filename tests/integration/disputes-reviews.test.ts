import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCheckoutOrder, setDelivery, preparePayment, handlePaymentSucceeded, completeOrder, autoReleaseOrders } from "@/lib/orders";
import { markDelivered, applyTrackingUpdate } from "@/lib/shipping";
import { openDispute, sellerRespond, buyerRespondToPartial, staffResolve, escalateOverdueDisputes, buyerCloseDispute } from "@/lib/disputes";
import { leaveReview, autoFeedback } from "@/lib/reviews";
import { getBalances } from "@/lib/wallet";
import { createListing, createUser } from "../helpers/factories";

vi.mock("@/lib/stripe", async () => (await import("../helpers/stripe-mock")).stripeModule());

let buyer: Awaited<ReturnType<typeof createUser>>;
let seller: Awaited<ReturnType<typeof createUser>>;

async function deliveredOrder(pricePence = 2000) {
  const l = await createListing(seller.id, { pricePence });
  const order = await createCheckoutOrder({ buyerId: buyer.id, listingIds: [l.id] });
  const addr = await db.address.findFirstOrThrow({ where: { userId: buyer.id } });
  await setDelivery({ orderId: order.id, buyerId: buyer.id, deliveryType: "HOME", addressId: addr.id });
  await preparePayment(order.id, buyer.id);
  const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  await handlePaymentSucceeded(o.stripePaymentIntentId!, "ch_x");
  await markDelivered(order.id);
  return { order: await db.order.findUniqueOrThrow({ where: { id: order.id } }), listing: l };
}

beforeEach(async () => {
  buyer = await createUser();
  seller = await createUser();
  for (const u of [buyer, seller]) await db.address.create({ data: { userId: u.id, fullName: u.name, line1: "1 Road", city: "York", postcode: "YO1 1AA", isDefault: true } });
});

describe("disputes", () => {
  it("can only be opened within 2 days of delivery", async () => {
    const { order } = await deliveredOrder();
    await db.order.update({ where: { id: order.id }, data: { deliveredAt: new Date(Date.now() - 3 * 86_400_000) } });
    await expect(openDispute({ orderId: order.id, buyerId: buyer.id, reason: "DAMAGED", description: "The zip is broken." })).rejects.toThrow("within 2 days");
  });

  it("puts the payment on hold so auto-release can't happen", async () => {
    const { order } = await deliveredOrder();
    await openDispute({ orderId: order.id, buyerId: buyer.id, reason: "NOT_AS_DESCRIBED", description: "Has a large stain not shown." });
    await autoReleaseOrders(new Date(Date.now() + 10 * 86_400_000));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DISPUTED");
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 2000, availablePence: 0 });
  });

  it("return flow: seller accepts return → return delivered → buyer refunded in full", async () => {
    const { order, listing } = await deliveredOrder();
    const d = await openDispute({ orderId: order.id, buyerId: buyer.id, reason: "DAMAGED", description: "Arrived torn at the seam." });
    await sellerRespond(d.id, seller.id, { kind: "accept_return" });
    expect((await db.dispute.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("RETURN_REQUESTED");
    // No carrier configured in tests, so add a return shipment with tracking as if posted.
    await db.shipment.create({ data: { orderId: order.id, direction: "RETURN", trackingNumber: "RET123", carrier: "Royal Mail", status: "IN_TRANSIT" } });
    await applyTrackingUpdate({ trackingNumber: "RET123", status: "DELIVERED", description: "Delivered", location: null, occurredAt: new Date() });
    const after = await db.dispute.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.status).toBe("RESOLVED_REFUND");
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("REFUNDED");
    expect(o.refundedPence).toBe(o.totalPence);
    expect((await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("HIDDEN");
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 0, availablePence: 0 });
  });

  it("partial refund accepted: buyer refunded part, seller gets the rest", async () => {
    const { order } = await deliveredOrder(2000);
    const d = await openDispute({ orderId: order.id, buyerId: buyer.id, reason: "NOT_AS_DESCRIBED", description: "Smaller than described." });
    await expect(sellerRespond(d.id, seller.id, { kind: "offer_partial", amountPence: 2000 })).rejects.toThrow("less than");
    await sellerRespond(d.id, seller.id, { kind: "offer_partial", amountPence: 500 });
    await buyerRespondToPartial(d.id, buyer.id, true);
    expect((await db.dispute.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("RESOLVED_PARTIAL_REFUND");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("COMPLETED");
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 0, availablePence: 1500 });
  });

  it("escalates when the seller doesn't respond, and support can release funds", async () => {
    const { order } = await deliveredOrder();
    const d = await openDispute({ orderId: order.id, buyerId: buyer.id, reason: "COUNTERFEIT", description: "Logo stitching looks fake." });
    await escalateOverdueDisputes(new Date(Date.now() + 3 * 86_400_000));
    expect((await db.dispute.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("ESCALATED");
    const staff = await createUser({ role: "admin" });
    await staffResolve(d.id, staff.id, { kind: "release" }, "Authenticity confirmed from receipt.");
    expect((await db.dispute.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("RESOLVED_RELEASED");
    expect(await getBalances(seller.id)).toEqual({ pendingPence: 0, availablePence: 2000 });
  });

  it("buyer can close the case, releasing funds", async () => {
    const { order } = await deliveredOrder();
    const d = await openDispute({ orderId: order.id, buyerId: buyer.id, reason: "MISSING", description: "Thought it was missing, found it." });
    await buyerCloseDispute(d.id, buyer.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("COMPLETED");
  });

  it("only the buyer of the order can open a case", async () => {
    const { order } = await deliveredOrder();
    await expect(openDispute({ orderId: order.id, buyerId: seller.id, reason: "DAMAGED", description: "Not my order really." })).rejects.toThrow("not found");
  });
});

describe("reviews", () => {
  it("allows one two-way review per order after completion and updates ratings", async () => {
    const { order } = await deliveredOrder();
    await expect(leaveReview({ orderId: order.id, authorId: buyer.id, rating: 5, text: "Great" })).rejects.toThrow("once the order is complete");
    await completeOrder(order.id, "buyer-confirmed");
    await leaveReview({ orderId: order.id, authorId: buyer.id, rating: 4, text: "Lovely item, quick post." });
    await leaveReview({ orderId: order.id, authorId: seller.id, rating: 5, text: "Fast payment, thanks!" });
    await expect(leaveReview({ orderId: order.id, authorId: buyer.id, rating: 5, text: "again" })).rejects.toThrow("already reviewed");
    expect((await db.user.findUniqueOrThrow({ where: { id: seller.id } })).ratingAvg).toBe(4);
    expect((await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).ratingCount).toBe(1);
  });

  it("leaves automatic 5-star feedback if the buyer confirmed but didn't review in 7 days", async () => {
    const { order } = await deliveredOrder();
    await completeOrder(order.id, "buyer-confirmed");
    await autoFeedback(new Date(Date.now() + 6 * 86_400_000));
    expect(await db.review.count({ where: { orderId: order.id } })).toBe(0);
    await autoFeedback(new Date(Date.now() + 8 * 86_400_000));
    const r = await db.review.findFirstOrThrow({ where: { orderId: order.id } });
    expect(r.isAutomatic).toBe(true);
    expect(r.rating).toBe(5);
  });

  it("does not auto-review when funds were released automatically (buyer never confirmed)", async () => {
    const { order } = await deliveredOrder();
    await completeOrder(order.id, "support");
    await autoFeedback(new Date(Date.now() + 30 * 86_400_000));
    expect(await db.review.count({ where: { orderId: order.id } })).toBe(0);
  });
});
