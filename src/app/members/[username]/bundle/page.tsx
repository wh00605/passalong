import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { cardSelect, visibleWhere } from "@/lib/listings";
import { getSettings } from "@/lib/settings";
import { photoUrl } from "@/lib/storage";
import { BundleBuilder } from "./bundle-builder";

export const metadata: Metadata = { title: "Build a bundle", robots: { index: false } };

export default async function BundlePage({ params }: PageProps<"/members/[username]/bundle">) {
  const { username } = await params;
  const seller = await db.user.findFirst({
    where: { username, deletedAt: null, holidayMode: false },
    select: { id: true, name: true, username: true, bundleDiscountsEnabled: true, bundleTiers: { orderBy: { minItems: "asc" } } },
  });
  if (!seller) notFound();
  const [items, viewer, settings] = await Promise.all([
    db.listing.findMany({ where: { ...visibleWhere, sellerId: seller.id, status: "ACTIVE" }, orderBy: { publishedAt: "desc" }, take: 100, select: cardSelect }),
    getCurrentUser(),
    getSettings(),
  ]);
  return (
    <div className="container-page py-8">
      <p className="eyebrow">@{seller.username}</p>
      <h1 className="mt-1 text-4xl font-extrabold">Bundle from {seller.name}</h1>
      <p className="mt-2 text-muted">Pick several items and pay postage once.{seller.bundleDiscountsEnabled && seller.bundleTiers.length ? ` ${seller.bundleTiers.map((t) => `${t.percentOff}% off ${t.minItems}+`).join(", ")}.` : ""}</p>
      <BundleBuilder
        sellerId={seller.id}
        isOwn={viewer?.id === seller.id}
        signedIn={!!viewer}
        tiers={seller.bundleDiscountsEnabled ? seller.bundleTiers.map((t) => ({ minItems: t.minItems, percentOff: t.percentOff })) : []}
        fees={{ fixed: settings.buyerProtectionFixedPence, bps: settings.buyerProtectionPercentBps }}
        items={items.map((i) => ({ id: i.id, title: i.title, pricePence: i.pricePence, size: i.size?.label ?? null, thumb: i.photos[0] ? photoUrl(i.photos[0].storageKey, 320) : null }))}
      />
    </div>
  );
}
