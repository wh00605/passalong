import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { eraseAccount, processDueDeletions } from "@/lib/account-deletion";
import { buildDataExport } from "@/lib/data-export";
import { searchListings } from "@/lib/listings";
import { evaluateReportSignals } from "@/lib/fraud";
import { createListing, createUser } from "../helpers/factories";

describe("account erasure (GDPR)", () => {
  it("anonymises the member and removes personal data", async () => {
    const user = await createUser({ name: "Erase Me" });
    const other = await createUser();
    await createListing(user.id);
    await db.address.create({ data: { userId: user.id, fullName: "Erase Me", line1: "1 High St", city: "Leeds", postcode: "LS1 1AA" } });
    await db.follow.create({ data: { followerId: other.id, followingId: user.id } });

    await eraseAccount(user.id);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.name).toBe("Deleted member");
    expect(after.email).toContain("deleted.passalong.invalid");
    expect(after.deletedAt).not.toBeNull();
    expect(await db.address.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.listing.count({ where: { sellerId: user.id } })).toBe(0);
    expect(await db.follow.count({ where: { followingId: user.id } })).toBe(0);
  });

  it("keeps sold listings (order records) but strips their content", async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing(seller.id, { status: "SOLD" });
    await db.order.create({
      data: {
        number: `T-${Date.now()}`, buyerId: buyer.id, sellerId: seller.id, itemsSubtotalPence: 2000, shippingPence: 299,
        buyerProtectionFeePence: 175, totalPence: 2474, sellerEarningsPence: 2000, status: "COMPLETED",
        items: { create: { listingId: listing.id, title: listing.title, pricePence: 2000 } },
      },
    });
    await eraseAccount(seller.id);
    const kept = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(kept.status).toBe("DELETED");
    expect(kept.description).toBe("");
    expect(await db.order.count({ where: { sellerId: seller.id } })).toBe(1);
  });

  it("processes only deletions whose grace period has ended", async () => {
    const due = await createUser();
    const notYet = await createUser();
    await db.deletionRequest.create({ data: { userId: due.id, scheduledFor: new Date(Date.now() - 1000) } });
    await db.deletionRequest.create({ data: { userId: notYet.id, scheduledFor: new Date(Date.now() + 86_400_000) } });
    const res = await processDueDeletions();
    expect(res.processed).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: notYet.id } })).deletedAt).toBeNull();
  });
});

describe("data export", () => {
  it("includes profile and listings but never secrets", async () => {
    const user = await createUser();
    await createListing(user.id, { title: "Export me" });
    await db.account.create({ data: { id: crypto.randomUUID(), accountId: user.id, providerId: "credential", userId: user.id, password: "hash-should-not-leak" } });
    const data = await buildDataExport(user.id);
    expect(data.profile.email).toBe(user.email);
    expect(data.listings.map((l) => l.title)).toContain("Export me");
    expect(JSON.stringify(data)).not.toContain("hash-should-not-leak");
  });
});

describe("visibility rules", () => {
  it("hides listings of members in holiday mode", async () => {
    const away = await createUser({ holidayMode: true });
    const here = await createUser();
    await createListing(away.id, { title: "zzholiday coat" });
    await createListing(here.id, { title: "zzholiday scarf" });
    const res = await searchListings({ q: "zzholiday" });
    expect(res.items.map((i) => i.title)).toEqual(["zzholiday scarf"]);
  });

  it("finds items by any word in any order", async () => {
    const seller = await createUser();
    await createListing(seller.id, { title: "Vintage green wool coat" });
    const res = await searchListings({ q: "coat green" });
    expect(res.items.some((i) => i.title === "Vintage green wool coat")).toBe(true);
  });
});

describe("fraud signals", () => {
  it("flags a member reported by 3 different people", async () => {
    const target = await createUser();
    for (let i = 0; i < 3; i++) {
      const reporter = await createUser();
      await db.report.create({ data: { reporterId: reporter.id, targetType: "USER", userId: target.id, reason: "scam" } });
    }
    await evaluateReportSignals(target.id);
    const signals = await db.fraudSignal.findMany({ where: { userId: target.id } });
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe("MANY_REPORTS");
  });
});
