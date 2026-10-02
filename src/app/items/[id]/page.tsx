import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { ShieldCheck, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { similarListings } from "@/lib/listings";
import { categoryTrail, conditionLabel } from "@/lib/catalogue";
import { listingIdFromParam, listingPath } from "@/lib/slug";
import { photoUrl } from "@/lib/storage";
import { formatPence } from "@/lib/money";
import { priceWithProtection } from "@/lib/fees";
import { daysAgo, timeAgo } from "@/lib/time";
import { siteUrl } from "@/lib/env";
import { Gallery } from "@/components/listing/gallery";
import { OwnerControls } from "@/components/listing/owner-controls";
import { ListingGrid } from "@/components/listing-grid";
import { FavouriteButton } from "@/components/favourite-button";
import { ReportButton } from "@/components/report-button";
import { Avatar } from "@/components/avatar";
import { Stars } from "@/components/stars";

async function load(id: string) {
  return db.listing.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      brand: true,
      size: true,
      material: true,
      colours: true,
      parcelSize: true,
      reservedFor: { select: { id: true, username: true } },
      seller: {
        select: {
          id: true, name: true, username: true, image: true, ratingAvg: true, ratingCount: true, location: true,
          lastActiveAt: true, showOnlineStatus: true, holidayMode: true, deletedAt: true, banned: true, identityVerifiedAt: true,
          bundleDiscountsEnabled: true, bundleTiers: { orderBy: { minItems: "asc" } },
        },
      },
    },
  });
}

const SCHEMA_CONDITION: Record<string, string> = {
  NEW_WITH_TAGS: "https://schema.org/NewCondition",
  NEW_WITHOUT_TAGS: "https://schema.org/NewCondition",
  VERY_GOOD: "https://schema.org/UsedCondition",
  GOOD: "https://schema.org/UsedCondition",
  SATISFACTORY: "https://schema.org/UsedCondition",
};

function isPublic(l: NonNullable<Awaited<ReturnType<typeof load>>>) {
  return (
    ["ACTIVE", "RESERVED", "SOLD"].includes(l.status) &&
    l.moderationStatus === "OK" &&
    !l.seller.holidayMode &&
    !l.seller.deletedAt &&
    !l.seller.banned
  );
}

export async function generateMetadata({ params }: PageProps<"/items/[id]">): Promise<Metadata> {
  const { id } = await params;
  const l = await load(listingIdFromParam(id));
  if (!l || !isPublic(l)) return { title: "Item not available", robots: { index: false } };
  const brand = l.brand?.name ?? l.customBrand;
  const description = `${[brand, l.size?.label, conditionLabel(l.condition)].filter(Boolean).join(" · ")} – ${formatPence(l.pricePence)}. ${l.description.slice(0, 120)}`;
  return {
    title: `${l.title}${brand && !l.title.includes(brand) ? ` – ${brand}` : ""}`,
    description,
    alternates: { canonical: listingPath(l) },
    openGraph: { type: "website", title: l.title, description, images: l.photos[0] ? [{ url: photoUrl(l.photos[0].storageKey, 1280) }] : [] },
    robots: l.status === "SOLD" ? { index: false } : undefined,
  };
}

export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
  const { id: param } = await params;
  const id = listingIdFromParam(param);
  const [l, viewer, settings] = await Promise.all([load(id), getCurrentUser(), getSettings()]);
  if (!l) notFound();
  const isOwner = viewer?.id === l.sellerId;
  if (!isPublic(l) && !isOwner && !isStaff(viewer)) notFound();
  if (param !== listingPath(l).split("/").pop()) permanentRedirect(listingPath(l));

  const [trail, similar, favourited, blocked] = await Promise.all([
    l.categoryId ? categoryTrail(l.categoryId) : [],
    similarListings(l),
    viewer ? db.favourite.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: l.id } } }) : null,
    viewer && !isOwner ? db.block.count({ where: { OR: [{ blockerId: viewer.id, blockedId: l.sellerId }, { blockerId: l.sellerId, blockedId: viewer.id }] } }) : 0,
  ]);

  // Record a view (deduplicated per member per day) after the response is sent.
  if (viewer && !isOwner) {
    after(async () => {
      const recent = await db.listingView.findFirst({ where: { listingId: l.id, userId: viewer.id, createdAt: { gt: daysAgo(1) } } });
      if (!recent) {
        await db.$transaction([
          db.listingView.create({ data: { listingId: l.id, userId: viewer.id } }),
          db.listing.update({ where: { id: l.id }, data: { viewCount: { increment: 1 } } }),
        ]);
      }
    });
  }

  const brand = l.brand?.name ?? l.customBrand;
  const total = priceWithProtection(l.pricePence, settings);
  const reservedForOther = l.status === "RESERVED" && l.reservedFor?.id !== viewer?.id;
  const canBuy = !isOwner && l.status !== "SOLD" && !reservedForOther && l.status !== "HIDDEN" && l.moderationStatus === "OK" && !blocked;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.description,
    image: l.photos.map((p) => photoUrl(p.storageKey, 1280)),
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(l.colours.length ? { color: l.colours.map((c) => c.name).join(", ") } : {}),
    ...(l.size ? { size: l.size.label } : {}),
    ...(l.material ? { material: l.material.name } : {}),
    offers: {
      "@type": "Offer",
      url: `${siteUrl}${listingPath(l)}`,
      priceCurrency: "GBP",
      price: (total / 100).toFixed(2),
      itemCondition: SCHEMA_CONDITION[l.condition ?? "GOOD"],
      availability: l.status === "SOLD" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      seller: { "@type": "Person", name: l.seller.name },
    },
  };

  const details: [string, React.ReactNode][] = [
    ["Brand", brand ? (l.brand ? <Link href={`/brands/${l.brand.slug}`} className="link">{brand}</Link> : brand) : "–"],
    ["Size", l.size?.label ?? "–"],
    ["Condition", conditionLabel(l.condition) || "–"],
    ["Colour", l.colours.map((c) => c.name).join(", ") || "–"],
    ["Material", l.material?.name ?? "–"],
    ["Category", trail.length ? <Link href={`/c/${trail.at(-1)!.path}`} className="link">{trail.map((c) => c.name).join(" › ")}</Link> : "–"],
    ["Uploaded", l.publishedAt ? timeAgo(l.publishedAt) : "Not published"],
    ["Views", l.viewCount],
    ["Favourites", l.favouriteCount],
  ];

  return (
    <div className="container-page py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-4 font-mono text-xs text-muted">
        <ol className="flex flex-wrap gap-1">
          <li><Link href="/" className="hover:underline">Home</Link> /</li>
          {trail.map((c, i) => (
            <li key={c.id}>
              <Link href={`/c/${c.path}`} className="hover:underline">{c.name}</Link>
              {i < trail.length - 1 && " /"}
            </li>
          ))}
        </ol>
      </nav>

      {l.moderationStatus !== "OK" && (isOwner || isStaff(viewer)) && (
        <p className="mb-4 rounded-lg border border-line bg-accent-300 p-3 text-sm font-semibold">
          {l.moderationStatus === "PENDING_REVIEW" ? "This item is being reviewed by our team and isn't visible to buyers yet." : "This item was removed by our team."}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Gallery
          title={l.title}
          photos={l.photos.map((p) => ({
            src: photoUrl(p.storageKey, 1280),
            srcSet: `${photoUrl(p.storageKey, 640)} 640w, ${photoUrl(p.storageKey, 1280)} 1280w`,
            width: p.width,
            height: p.height,
            blurData: p.blurData,
          }))}
        />

        <div className="space-y-6">
          <div>
            {l.status === "SOLD" && <span className="tag mb-3 bg-brand-600 text-white">Sold</span>}
            {l.status === "RESERVED" && <span className="tag mb-3 bg-surface">Reserved</span>}
            <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">{l.title}</h1>
            <p className="mt-1 font-mono text-sm text-muted">{[brand, l.size?.label, conditionLabel(l.condition)].filter(Boolean).join(" / ")}</p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/* Headline price includes the mandatory Buyer Protection fee (DMCC Act 2024). */}
              <span className="font-display text-4xl text-ink tabular-nums" style={{ fontVariationSettings: '"opsz" 96' }}>{formatPence(total)}</span>
              <span className="text-sm text-muted">
                incl. <Link href="/help/buyer-protection" className="link">Buyer Protection</Link> · item {formatPence(l.pricePence)}
              </span>
            </div>
            {l.parcelSize && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Truck className="h-4 w-4" aria-hidden="true" /> Postage from {formatPence(l.parcelSize.pricePence)} ({l.parcelSize.name.toLowerCase()} parcel)
              </p>
            )}
          </div>

          {isOwner ? (
            <OwnerControls id={l.id} status={l.status} reservedFor={l.reservedFor?.username ?? null} />
          ) : (
            <div className="space-y-2">
              {canBuy ? (
                <>
                  <Link href={viewer ? `/checkout/start?listing=${l.id}` : `/login?next=${encodeURIComponent(listingPath(l))}`} className="btn-primary w-full text-base">Buy now</Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={viewer ? `/inbox/start?listing=${l.id}&offer=1` : `/login?next=${encodeURIComponent(listingPath(l))}`} className="btn-secondary">Make an offer</Link>
                    <Link href={viewer ? `/inbox/start?listing=${l.id}` : `/login?next=${encodeURIComponent(listingPath(l))}`} className="btn-secondary">Message seller</Link>
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-line p-3 text-sm text-muted">
                  {blocked ? "You can't buy from this member." : l.status === "SOLD" ? "This item has sold." : reservedForOther ? "This item is reserved for another buyer." : "This item isn't available right now."}
                </p>
              )}
              <FavouriteButton listingId={l.id} initial={!!favourited} count={l.favouriteCount} signedIn={!!viewer} title={l.title} variant="full" />
            </div>
          )}

          <p className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Buyer Protection.</strong> Pay through Passalong and we hold the money until you confirm the item is as described.{" "}
              <Link href="/help/buyer-protection" className="link">How it works</Link>
            </span>
          </p>

          <section aria-labelledby="desc-h">
            <h2 id="desc-h" className="sr-only">Description</h2>
            <p className="whitespace-pre-line">{l.description}</p>
          </section>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-xs tracking-wider text-muted uppercase">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="seller-h" className="card p-4">
            <h2 id="seller-h" className="sr-only">Seller</h2>
            <Link href={`/members/${l.seller.username}`} className="flex items-center gap-3">
              <Avatar name={l.seller.name} image={l.seller.image} size={48} />
              <span className="min-w-0">
                <span className="block font-semibold">{l.seller.name}</span>
                <span className="block font-mono text-xs text-muted">@{l.seller.username}{l.seller.location ? ` · ${l.seller.location}` : ""}</span>
                {l.seller.ratingCount > 0 ? <Stars rating={l.seller.ratingAvg} count={l.seller.ratingCount} size={14} /> : <span className="text-xs text-muted">No reviews yet</span>}
              </span>
            </Link>
            {l.seller.showOnlineStatus && l.seller.lastActiveAt && <p className="mt-2 text-xs text-muted">Active {timeAgo(l.seller.lastActiveAt)}</p>}
            {l.seller.bundleDiscountsEnabled && l.seller.bundleTiers.length > 0 && (
              <p className="mt-3 text-sm">
                <strong>Bundle discount:</strong> {l.seller.bundleTiers.map((t) => `${t.percentOff}% off ${t.minItems}+`).join(", ")}.{" "}
                <Link href={`/members/${l.seller.username}`} className="link">Shop their wardrobe</Link>
              </p>
            )}
          </section>

          {!isOwner && viewer && (
            <div className="flex justify-end">
              <ReportButton targetType="LISTING" targetId={l.id} label="Report item" />
            </div>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-14" aria-labelledby="similar-h">
          <h2 id="similar-h" className="mb-5 border-b border-line pb-2 text-2xl font-semibold sm:text-3xl">Similar items</h2>
          <ListingGrid listings={similar} priorityCount={0} />
        </section>
      )}
    </div>
  );
}
