import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { ListingGrid } from "@/components/listing-grid";
import { ListingPhoto } from "@/components/listing-card";
import { Avatar } from "@/components/avatar";
import { Stars } from "@/components/stars";
import { getCurrentUser } from "@/lib/session";
import { categoryCovers, personalisedFeed, popularBrands, topWardrobes } from "@/lib/listings";
import { getTopCategories } from "@/lib/catalogue";
import { getSettings } from "@/lib/settings";
import { priceWithProtection } from "@/lib/fees";
import { formatPence } from "@/lib/money";
import { listingPath } from "@/lib/slug";
import { siteUrl } from "@/lib/env";

function SectionTitle({ id, title, href, linkLabel = "See all" }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 id={id} className="text-xl sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
          {linkLabel} <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [feed, settings, categories, brands, wardrobes] = await Promise.all([
    personalisedFeed(user?.id ?? null, 40),
    getSettings(),
    getTopCategories(),
    popularBrands(14),
    topWardrobes(6, user?.id),
  ]);
  const fan = feed.filter((l) => l.photos[0]).slice(0, 3);
  const covers = await categoryCovers(categories.map((c) => c.id));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Passalong",
    url: siteUrl,
    potentialAction: { "@type": "SearchAction", target: `${siteUrl}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="container-page">
        {user ? (
          <p className="mt-7 text-2xl font-semibold tracking-tight">
            Hi {user.name.split(" ")[0]} <span aria-hidden="true">👋</span>
          </p>
        ) : (
          <section aria-labelledby="hero-title" className="relative mt-5 overflow-hidden rounded-[1.75rem] bg-brand-600 text-white">
            <span aria-hidden="true" className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-brand-500/60" />
            <span aria-hidden="true" className="absolute right-[38%] -bottom-28 h-64 w-64 rounded-full bg-coral/25" />
            <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 md:grid-cols-[1.05fr_1fr] md:py-12 lg:px-14">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-coral" aria-hidden="true" /> Pre-loved, from people across the UK
                </p>
                <h1 id="hero-title" className="mt-4 text-[2.1rem] leading-[1.08] text-white sm:text-5xl">
                  Pass it on.
                  <br />
                  <span className="text-[#ffc4b2]">Find something new.</span>
                </h1>
                <p className="mt-4 max-w-md text-brand-100">
                  Sell what you don&apos;t wear for free, and shop one-off finds with Buyer Protection on every order.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/sell" className="btn bg-white px-6 text-brand-700 hover:bg-brand-50">List an item</Link>
                  <Link href="/search?sort=newest" className="btn border-white/50 px-6 text-white hover:border-white hover:bg-white/10">Start browsing</Link>
                </div>
                <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-100" role="list">
                  <li>✓ No selling fees</li>
                  <li>✓ Buyer Protection</li>
                  <li>✓ Postage from £2.99</li>
                </ul>
              </div>
              {fan.length === 3 && (
                <ul className="relative mx-auto hidden h-[330px] w-full max-w-[480px] md:block" role="list" aria-label="Just listed">
                  {fan.map((l, i) => {
                    const pos = ["left-0 top-10 -rotate-[7deg]", "left-1/2 top-0 -translate-x-1/2 rotate-[2deg] z-10", "right-0 top-12 rotate-[8deg]"][i];
                    return (
                      <li key={l.id} className={`absolute w-[42%] ${pos}`}>
                        <Link href={listingPath(l)} className="block rounded-2xl bg-surface p-2 text-ink shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-1">
                          <span className="relative block">
                            <ListingPhoto photo={l.photos[0]} alt="" priority className="aspect-[4/5] w-full rounded-xl" sizes="200px" />
                            <span className="absolute bottom-2 left-2 rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold">{formatPence(priceWithProtection(l.pricePence, settings))}</span>
                          </span>
                          <span className="flex items-center gap-1.5 px-1 pt-2 pb-0.5 text-xs text-muted">
                            <Avatar name={l.seller.name} image={l.seller.image} size={18} />
                            <span className="truncate">{l.seller.username}</span>
                          </span>
                          <span className="sr-only">{l.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        <nav aria-label="Shop by category" className="mt-9">
          <ul className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-8" role="list">
            {categories.map((c) => {
              const cover = covers.get(c.id);
              return (
                <li key={c.id} className="shrink-0">
                  <Link href={`/c/${c.path}`} className="group flex w-20 flex-col items-center gap-2 text-center sm:w-24">
                    <span className="block h-20 w-20 overflow-hidden rounded-full bg-shade ring-2 ring-transparent ring-offset-2 ring-offset-canvas transition group-hover:ring-coral sm:h-24 sm:w-24">
                      {cover && <ListingPhoto photo={cover} alt="" sizes="96px" className="h-full w-full scale-125" />}
                    </span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="mt-8" aria-labelledby="feed-title">
          <SectionTitle id="feed-title" title={user?.allowPersonalisation ? "Picked for you" : "Fresh finds"} href="/search?sort=newest" linkLabel="Browse all" />
          {user && user.allowPersonalisation && user.preferredSizeIds.length === 0 && (
            <p className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3 text-sm">
              <span>Tell us your sizes and favourite brands to tailor your feed.</span>
              <Link href="/settings/personalisation" className="btn-primary btn-sm">Personalise</Link>
            </p>
          )}
          <ListingGrid listings={feed.slice(0, 20)} gridClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" empty="Nothing listed yet – be the first to sell something." />
        </section>

        {wardrobes.length > 0 && (
          <section className="mt-14" aria-labelledby="wardrobes-title">
            <SectionTitle id="wardrobes-title" title="Sellers worth following" />
            <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3" role="list">
              {wardrobes.map((w) => (
                <li key={w.id} className="w-[85%] shrink-0 snap-start sm:w-auto">
                  <Link href={`/members/${w.username}`} className="block rounded-xl border border-line p-4 transition-shadow hover:shadow-[var(--shadow-tag-sm)]">
                    <span className="flex items-center gap-3">
                      <Avatar name={w.name} image={w.image} size={44} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{w.username}</span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {w.ratingCount > 0 ? <Stars rating={w.ratingAvg} count={w.ratingCount} size={12} /> : "New seller"}
                          {w.location && (
                            <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" aria-hidden="true" />{w.location}</span>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
                      {w.listings.map((l) => (
                        <ListingPhoto key={l.id} photo={l.photos[0]} alt="" sizes="120px" className="aspect-square w-full rounded-md" />
                      ))}
                    </span>
                    <span className="mt-2 block text-xs text-muted">{w.activeCount} item{w.activeCount === 1 ? "" : "s"} for sale · {w.followerCount} follower{w.followerCount === 1 ? "" : "s"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {feed.length > 20 && (
          <section className="mt-14" aria-labelledby="more-title">
            <SectionTitle id="more-title" title="Keep scrolling" href="/search?sort=newest" />
            <ListingGrid listings={feed.slice(20, 40)} priorityCount={0} gridClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" />
          </section>
        )}

        {brands.length > 0 && (
          <section className="mt-14" aria-labelledby="brand-title">
            <SectionTitle id="brand-title" title="Popular brands" />
            <ul className="flex flex-wrap gap-2" role="list">
              {brands.map((b) => (
                <li key={b.id}>
                  <Link href={`/brands/${b.slug}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm hover:border-ink">
                    {b.name} <span className="text-xs text-muted">{b.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-14 grid gap-4 md:grid-cols-3" aria-labelledby="how-title">
          <h2 id="how-title" className="sr-only">How Passalong works</h2>
          {[
            ["Sell for free", "Snap a few photos, set your price, and post with a prepaid label when it sells.", "/help/how-selling-works"],
            ["Buy with protection", "Your money is held until you confirm the item is as described.", "/help/buyer-protection"],
            ["Make an offer", "Chat with the seller, make an offer or bundle items to save on postage.", "/help/making-offers"],
          ].map(([t, b, href]) => (
            <Link key={t} href={href} className="rounded-xl bg-shade p-5 transition-colors hover:bg-brand-50">
              <span className="block font-semibold">{t}</span>
              <span className="mt-1 block text-sm text-muted">{b}</span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
