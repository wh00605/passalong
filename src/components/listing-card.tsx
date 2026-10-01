import Link from "next/link";
import { photoUrl } from "@/lib/storage";
import { formatPence } from "@/lib/money";
import { priceWithProtection } from "@/lib/fees";
import { listingPath } from "@/lib/slug";
import { conditionLabel } from "@/lib/conditions";
import { isFuture } from "@/lib/time";
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
  const bumped = isFuture(listing.bumpedUntil);
  const total = priceWithProtection(listing.pricePence, fees);

  return (
    <article className="group relative">
      <div className="relative overflow-hidden rounded-2xl bg-[#f1ede6] ring-brand-600 ring-offset-2 group-focus-within:ring-2">
        <ListingPhoto photo={listing.photos[0]} alt="" priority={priority} className="aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
        {(listing.status === "RESERVED" || bumped) && (
          <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-medium ${listing.status === "RESERVED" ? "bg-brand-600 text-white" : "bg-surface/95 text-ink backdrop-blur"}`}>
            {listing.status === "RESERVED" ? "Reserved" : "Featured"}
          </span>
        )}
        {!compact && (
          <div className="absolute top-3 right-3">
            <FavouriteButton listingId={listing.id} initial={favourited} count={listing.favouriteCount} signedIn={signedIn} title={listing.title} />
          </div>
        )}
      </div>
      <div className={compact ? "mt-2" : "mt-3 space-y-0.5 px-0.5"}>
        {!compact && brand && <p className="line-clamp-1 text-[0.7rem] font-medium tracking-[0.12em] text-accent-600 uppercase">{brand}</p>}
        <h3 className={`line-clamp-1 font-sans font-normal tracking-normal text-ink ${compact ? "text-xs" : "text-[0.95rem]"}`}>
          <Link href={listingPath(listing)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {listing.title}
            {compact && <span className="sr-only">, {formatPence(listing.pricePence)}</span>}
          </Link>
        </h3>
        {compact ? (
          <p className="text-xs font-medium" aria-hidden="true">{formatPence(listing.pricePence)}</p>
        ) : (
          <>
            <p className="line-clamp-1 text-xs text-muted">
              {[listing.size?.label, conditionLabel(listing.condition)].filter(Boolean).join(" · ")}
            </p>
            <p className="flex items-baseline gap-2 pt-1">
              {/* Headline price includes the mandatory Buyer Protection fee (DMCC Act 2024). */}
              <span className="text-[0.95rem] font-semibold text-ink tabular-nums">{formatPence(total)}</span>
              <span className="text-xs text-muted tabular-nums">incl. protection · item {formatPence(listing.pricePence)}</span>
            </p>
          </>
        )}
      </div>
    </article>
  );
}
