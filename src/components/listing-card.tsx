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
import { Avatar } from "@/components/avatar";

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
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-2xl bg-shade ring-brand-600 ring-offset-2 group-focus-within:ring-2">
        <ListingPhoto photo={listing.photos[0]} alt="" priority={priority} className="aspect-[4/5] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        {(listing.status === "RESERVED" || bumped) && (
          <span className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${listing.status === "RESERVED" ? "bg-ink/85 text-white" : "bg-coral-50 text-coral-700"}`}>
            {listing.status === "RESERVED" ? "Reserved" : "Bumped"}
          </span>
        )}
        {!compact && (
          <div className="absolute top-2 right-2">
            <FavouriteButton listingId={listing.id} initial={favourited} count={listing.favouriteCount} signedIn={signedIn} title={listing.title} />
          </div>
        )}
        {/* Price tag: the all-in price including the mandatory Buyer Protection fee (DMCC Act 2024). */}
        <span className={`absolute bottom-2.5 left-2.5 rounded-full bg-surface/95 font-bold text-ink tabular-nums shadow-[0_1px_4px_rgba(23,23,28,0.18)] backdrop-blur ${compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm"}`}>
          {formatPence(total)}
          <span className="sr-only"> including Buyer Protection</span>
        </span>
      </div>
      <div className={compact ? "mt-1.5" : "mt-2.5 flex flex-1 flex-col px-0.5"}>
        <h3 className={`line-clamp-1 text-ink ${compact ? "text-xs font-medium" : "text-[0.9rem] font-medium"}`}>
          <Link href={listingPath(listing)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {listing.title}
          </Link>
        </h3>
        {!compact && (
          <>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted">
              {[brand, listing.size?.label, conditionLabel(listing.condition)].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-0.5 text-[11px] text-subtle tabular-nums">Item {formatPence(listing.pricePence)} + protection</p>
            <Link
              href={`/members/${listing.seller.username}`}
              className="relative z-10 mt-2 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pr-2.5 pl-0.5 text-xs text-muted hover:border-line-strong hover:text-ink"
            >
              <Avatar name={listing.seller.name} image={listing.seller.image} size={18} />
              <span className="truncate">{listing.seller.username}</span>
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
