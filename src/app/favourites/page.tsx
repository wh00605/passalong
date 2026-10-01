import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { cardSelect } from "@/lib/listings";
import { ListingGrid } from "@/components/listing-grid";

export const metadata: Metadata = { title: "Favourites", robots: { index: false } };

export default async function FavouritesPage() {
  const user = await requireUser("/favourites");
  const favs = await db.favourite.findMany({
    where: { userId: user.id, listing: { status: { notIn: ["DELETED", "REMOVED", "DRAFT"] } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { listing: { select: cardSelect } },
  });
  return (
    <div className="container-page py-8">
      <h1 className="border-b-2 border-ink pb-3 text-4xl font-extrabold">Favourites</h1>
      <p className="mt-3 text-sm text-muted">We&apos;ll let you know if any of these drop in price. Manage alerts in <Link href="/settings/notifications" className="link">notification settings</Link>.</p>
      <div className="mt-6">
        <ListingGrid listings={favs.map((f) => f.listing)} empty={<>No favourites yet. Tap the heart on anything you like.</>} />
      </div>
    </div>
  );
}
