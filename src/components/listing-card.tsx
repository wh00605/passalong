import Link from "next/link";
import { photoUrl } from "@/lib/storage";
import { formatPence } from "@/lib/money";
import { priceWithProtection } from "@/lib/fees";
import { listingPath } from "@/lib/slug";
import { conditionLabel } from "@/lib/conditions";
import type { ListingCardData } from "@/lib/listings";
import type { PlatformSettings } from "@/lib/settings-defaults";
import { FavouriteButton } from "@/components/favourite-button";

export function ListingPhoto({
  photo,
  alt,
  sizes = "(min-width: 1280px) 240px, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw",
  priority = false,
  className = "",
}: {
  photo?: { storageKey: string; width: number; height: number; blurData: string | null } | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!photo) {
    return <div className={`flex items-center justify-center bg-brand-50 font-mono text-xs text-muted uppercase ${className}`}>No photo</div>;
  }
  return (
    // Photos are pre-resized to WebP at upload, so a native responsive <img> is the fastest option.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl(photo.storageKey, 640)}
      srcSet={`${photoUrl(photo.storageKey, 320)} 320w, ${photoUrl(photo.storageKey, 640)} 640w, ${photoUrl(photo.storageKey, 1280)} 1280w`}
      sizes={sizes}
      alt={alt}
      width={photo.width}
      height={photo.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`object-cover ${className}`}
      style={photo.blurData ? { backgroundImage: `url(${photo.blurData})`, backgroundSize: "cover" } : undefined}
    />
  );
}

export function ListingCard({
  listing,
  fees,
  favourited,
  signedIn,
  priority,
  compact = false,
}: {
  listing: ListingCardData;
  fees: Pick<PlatformSettings, "buyerProtectionFixedPence" | "buyerProtectionPercentBps">;
  favourited: boolean;
  signedIn: boolean;
  priority?: boolean;
  compact?: boolean;
}) {
  const brand = listing.brand?.name ?? listing.customBrand;
  const bumped = listing.bumpedUntil && listing.bumpedUntil.getTime() > Date.now();
  const total = priceWithProtection(listing.pricePence, fees);

  return (
    <article className="group relative">
      <div className="relative overflow-hidden rounded-md border-2 border-ink bg-brand-50 transition-[transform,box-shadow] duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-tag)] group-focus-within:-translate-x-1 group-focus-within:-translate-y-1 group-focus-within:shadow-[var(--shadow-tag)]">
        <ListingPhoto photo={listing.photos[0]} alt="" priority={priority} className="aspect-[4/5] w-full" />
        {(listing.status === "RESERVED" || bumped) && (
          <span
            className={`absolute top-2 left-2 rounded-sm border-2 border-ink px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase ${listing.status === "RESERVED" ? "bg-ink text-surface" : "bg-surface text-ink"}`}
          >
            {listing.status === "RESERVED" ? "Reserved" : "Bumped"}
          </span>
        )}
        {!compact && (
          <span className="absolute bottom-2 left-2 rounded-sm border-2 border-ink bg-accent-400 px-1.5 py-0.5 font-mono text-sm font-bold text-ink">
            {formatPence(listing.pricePence)}
          </span>
        )}
        {!compact && (
          <div className="absolute top-2 right-2">
            <FavouriteButton listingId={listing.id} initial={favourited} count={listing.favouriteCount} signedIn={signedIn} title={listing.title} />
          </div>
        )}
      </div>
      <div className={compact ? "mt-1.5" : "mt-2.5 space-y-0.5"}>
        <h3 className={`line-clamp-1 font-sans font-semibold tracking-normal ${compact ? "text-xs" : "text-sm"}`}>
          <Link href={listingPath(listing)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {listing.title}
            {compact && <span className="sr-only">, {formatPence(listing.pricePence)}</span>}
          </Link>
        </h3>
        {compact ? (
          <p className="font-mono text-xs" aria-hidden="true">{formatPence(listing.pricePence)}</p>
        ) : (
          <>
            <p className="line-clamp-1 font-mono text-xs text-muted">
              {[brand, listing.size?.label, conditionLabel(listing.condition)].filter(Boolean).join(" / ")}
            </p>
            <p className="text-xs text-muted">
              <span className="font-semibold text-ink">{formatPence(total)}</span> incl. Buyer Protection
            </p>
          </>
        )}
      </div>
    </article>
  );
}
