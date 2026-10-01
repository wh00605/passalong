"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/session";
import { safeAction } from "@/lib/action";
import { enforceRateLimit } from "@/lib/rate-limit";
import { visibleWhere } from "@/lib/listings";

export async function toggleFavouriteAction(listingId: string) {
  return safeAction(async () => {
    const id = z.string().cuid().parse(listingId);
    const user = await requireUserForAction();
    await enforceRateLimit("favourite", user.id, 120, 60);

    const existing = await db.favourite.findUnique({ where: { userId_listingId: { userId: user.id, listingId: id } } });
    if (existing) {
      await db.$transaction([
        db.favourite.delete({ where: { userId_listingId: { userId: user.id, listingId: id } } }),
        db.listing.update({ where: { id }, data: { favouriteCount: { decrement: 1 } } }),
      ]);
      return { favourited: false };
    }
    const listing = await db.listing.findFirst({ where: { id, ...visibleWhere }, select: { pricePence: true, sellerId: true } });
    if (!listing) throw new Error("Listing not available");
    await db.$transaction([
      db.favourite.create({ data: { userId: user.id, listingId: id, pricePenceAtSave: listing.pricePence } }),
      db.listing.update({ where: { id }, data: { favouriteCount: { increment: 1 } } }),
    ]);
    return { favourited: true };
  });
}
