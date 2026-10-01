import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { actingAs, form } from "../helpers/session-mock";
import { createCatalogue, createUser } from "../helpers/factories";
import { saveListingAction, listingOpAction } from "@/app/actions/listings";

vi.mock("@/lib/session", async () => (await import("../helpers/session-mock")).sessionModule());
vi.mock("next/headers", async () => (await import("../helpers/session-mock")).headersModule());

let seller: Awaited<ReturnType<typeof createUser>>;
let catalogue: Awaited<ReturnType<typeof createCatalogue>>;

async function photo(uploaderId: string) {
  return db.listingPhoto.create({ data: { uploaderId, storageKey: `test/${crypto.randomUUID()}`, width: 800, height: 1000 } });
}

async function publish(fields: Partial<Record<string, string | string[]>> = {}) {
  const p = await photo(seller.id);
  return saveListingAction(
    {},
    form({
      intent: "publish",
      title: "Blue linen shirt",
      description: "Lovely summer shirt, worn twice.",
      categoryId: catalogue.category.id,
      condition: "VERY_GOOD",
      price: "15",
      parcelSizeId: catalogue.parcel.id,
      photoIds: [p.id],
      ...fields,
    } as Record<string, string | string[]>),
  );
}

beforeAll(async () => {
  seller = await createUser({ createdAt: new Date(Date.now() - 90 * 86_400_000) });
  catalogue = await createCatalogue();
  await db.prohibitedTerm.createMany({
    data: [
      { term: "replica", severity: "BLOCK" },
      { term: "fur", severity: "REVIEW" },
    ],
    skipDuplicates: true,
  });
  actingAs.userId = seller.id;
});

describe("publishing a listing", () => {
  it("publishes a complete listing", async () => {
    const res = await publish();
    expect(res.ok).toBe(true);
    const l = await db.listing.findUniqueOrThrow({ where: { id: res.data!.id as string }, include: { photos: true, priceHistory: true } });
    expect(l.status).toBe("ACTIVE");
    expect(l.pricePence).toBe(1500);
    expect(l.photos).toHaveLength(1);
    expect(l.searchText).toContain("blue linen shirt");
    expect(l.priceHistory).toHaveLength(1);
  });

  it("validates required fields on the server", async () => {
    const res = await saveListingAction({}, form({ intent: "publish", title: "x" }));
    expect(res.ok).toBeFalsy();
    expect(Object.keys(res.fieldErrors ?? {})).toEqual(expect.arrayContaining(["title", "description", "categoryId", "condition", "price", "parcelSizeId", "photos"]));
  });

  it("allows a minimal draft", async () => {
    const res = await saveListingAction({}, form({ intent: "draft", title: "Half-finished" }));
    expect(res.ok).toBe(true);
    const l = await db.listing.findUniqueOrThrow({ where: { id: res.data!.id as string } });
    expect(l.status).toBe("DRAFT");
  });

  it("blocks prohibited keywords", async () => {
    const res = await publish({ title: "Designer replica handbag" });
    expect(res.ok).toBeFalsy();
    expect(res.error).toContain("replica");
  });

  it("holds review keywords for moderation", async () => {
    const res = await publish({ title: "Faux fur collar coat" });
    expect(res.ok).toBe(true);
    const l = await db.listing.findUniqueOrThrow({ where: { id: res.data!.id as string } });
    expect(l.moderationStatus).toBe("PENDING_REVIEW");
  });

  it("rejects photos uploaded by someone else", async () => {
    const other = await createUser();
    const p = await photo(other.id);
    const res = await publish({ photoIds: [p.id] });
    expect(res.fieldErrors?.photos).toBeTruthy();
  });

  it("holds high-value listings from brand-new accounts and raises a fraud signal", async () => {
    const newbie = await createUser();
    actingAs.userId = newbie.id;
    const p = await photo(newbie.id);
    const res = await saveListingAction({}, form({
      intent: "publish", title: "Designer watch", description: "Barely worn, with box.", categoryId: catalogue.category.id,
      condition: "VERY_GOOD", price: "900", parcelSizeId: catalogue.parcel.id, photoIds: [p.id],
    }));
    actingAs.userId = seller.id;
    expect(res.ok).toBe(true);
    const l = await db.listing.findUniqueOrThrow({ where: { id: res.data!.id as string } });
    expect(l.moderationStatus).toBe("PENDING_REVIEW");
    expect(await db.fraudSignal.count({ where: { userId: newbie.id, type: "NEW_ACCOUNT_HIGH_VALUE" } })).toBe(1);
  });
});

describe("editing", () => {
  it("notifies members who favourited when the price drops", async () => {
    const res = await publish({ price: "40" });
    const id = res.data!.id as string;
    const fan = await createUser();
    await db.favourite.create({ data: { userId: fan.id, listingId: id, pricePenceAtSave: 4000 } });
    const l = await db.listing.findUniqueOrThrow({ where: { id }, include: { photos: true } });
    const res2 = await saveListingAction({}, form({
      listingId: id, intent: "publish", title: l.title, description: l.description, categoryId: l.categoryId!, condition: "VERY_GOOD",
      price: "30", parcelSizeId: l.parcelSizeId!, photoIds: l.photos.map((p) => p.id),
    }));
    expect(res2.ok).toBe(true);
    const n = await db.notification.findMany({ where: { userId: fan.id, type: "PRICE_DROP" } });
    expect(n).toHaveLength(1);
    expect(n[0].body).toContain("£30.00");
  });

  it("won't let another member edit the listing", async () => {
    const res = await publish();
    const intruder = await createUser();
    actingAs.userId = intruder.id;
    const res2 = await saveListingAction({}, form({ listingId: res.data!.id as string, intent: "draft", title: "Hacked" }));
    actingAs.userId = seller.id;
    expect(res2.error).toBe("Listing not found.");
  });
});

describe("listing operations", () => {
  it("reserves for a buyer, hides, and deletes", async () => {
    const res = await publish();
    const id = res.data!.id as string;
    const buyer = await createUser();
    expect((await listingOpAction({ id, op: "reserve", username: buyer.username })).ok).toBe(true);
    let l = await db.listing.findUniqueOrThrow({ where: { id } });
    expect(l.status).toBe("RESERVED");
    expect(l.reservedForId).toBe(buyer.id);
    expect((await listingOpAction({ id, op: "hide" })).ok).toBe(true);
    l = await db.listing.findUniqueOrThrow({ where: { id } });
    expect(l.status).toBe("HIDDEN");
    expect((await listingOpAction({ id, op: "delete" })).ok).toBe(true);
    expect(await db.listing.findUnique({ where: { id } })).toBeNull();
  });
});
