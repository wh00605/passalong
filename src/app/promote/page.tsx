import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatPence } from "@/lib/money";
import { integrations } from "@/lib/env";
import { PromotePay } from "./promote-pay";

export const metadata: Metadata = { title: "Promote", robots: { index: false } };

export default async function PromotePage({ searchParams }: PageProps<"/promote">) {
  const user = await requireUser("/promote");
  const sp = await searchParams;
  const s = await getSettings();
  const listing = typeof sp.listing === "string" ? await db.listing.findFirst({ where: { id: sp.listing, sellerId: user.id, status: "ACTIVE" }, select: { id: true, title: true, bumpedUntil: true } }) : null;
  const activeSpotlight = await db.promotion.findFirst({ where: { userId: user.id, type: "WARDROBE_SPOTLIGHT", status: "ACTIVE", endsAt: { gt: new Date() } } });

  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="border-b-2 border-ink pb-3 text-4xl font-extrabold">Promote</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card flex flex-col p-5" aria-labelledby="bump-h">
          <p className="eyebrow">One item</p>
          <h2 id="bump-h" className="mt-1 text-2xl font-extrabold">Bump</h2>
          <p className="mt-1 font-mono text-lg">{formatPence(s.bumpPricePence)} · {s.bumpDays} days</p>
          <p className="mt-2 flex-1 text-sm">Your item is boosted to the top of search results and feeds, with a “Bumped” label.</p>
          {listing ? (
            listing.bumpedUntil && listing.bumpedUntil > new Date() ? (
              <p className="mt-3 text-sm font-semibold">“{listing.title}” is bumped until {listing.bumpedUntil.toLocaleDateString("en-GB")}.</p>
            ) : (
              <PromotePay type="BUMP" listingId={listing.id} label={`Bump “${listing.title}” for ${formatPence(s.bumpPricePence)}`} configured={integrations.stripe()} publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""} />
            )
          ) : (
            <p className="mt-3 text-sm">Open one of <Link href="/drafts?status=ACTIVE" className="link">your live items</Link> and tap “Bump”.</p>
          )}
        </section>
        <section className="card flex flex-col p-5" aria-labelledby="spot-h">
          <p className="eyebrow">Whole wardrobe</p>
          <h2 id="spot-h" className="mt-1 text-2xl font-extrabold">Wardrobe spotlight</h2>
          <p className="mt-1 font-mono text-lg">{formatPence(s.spotlightPricePence)} · {s.spotlightDays} days</p>
          <p className="mt-2 flex-1 text-sm">Your wardrobe is featured on the home page and your items rank higher. Needs at least 5 live items.</p>
          {activeSpotlight ? (
            <p className="mt-3 text-sm font-semibold">Your wardrobe is in the spotlight until {activeSpotlight.endsAt?.toLocaleDateString("en-GB")}.</p>
          ) : (
            <PromotePay type="WARDROBE_SPOTLIGHT" label={`Start spotlight for ${formatPence(s.spotlightPricePence)}`} configured={integrations.stripe()} publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""} />
          )}
        </section>
      </div>
      <p className="mt-6 text-xs text-muted">Promotions are paid services and are non-refundable once started. Promoted items are labelled.</p>
    </div>
  );
}
