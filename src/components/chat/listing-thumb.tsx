export function ListingThumb({ src, className = "" }: { src: string | null; className?: string }) {
  if (!src) return <span className={`shrink-0 rounded-sm border-2 border-ink bg-brand-50 ${className}`} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className={`shrink-0 rounded-sm border-2 border-ink object-cover ${className}`} />;
}
