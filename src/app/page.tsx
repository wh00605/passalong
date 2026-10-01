import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ListingGrid } from "@/components/listing-grid";
import { ListingCard, ListingPhoto } from "@/components/listing-card";
import { Avatar } from "@/components/avatar";
import { getCurrentUser } from "@/lib/session";
import { categoryCovers, personalisedFeed, popularBrands, spotlightWardrobes } from "@/lib/listings";
import { getTopCategories } from "@/lib/catalogue";
import { getSettings } from "@/lib/settings";
import { listingPath } from "@/lib/slug";
import { siteUrl } from "@/lib/env";

const PRICE_BANDS = [10, 20, 50, 100];

function Heading({ id, eyebrow, title, href }: { id: string; eyebrow: string; title: string; href?: string }) {
  return (
    <div className="mb-10 text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-4xl sm:text-5xl">{title}</h2>
      {href && (
        <Link href={href} className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-[0.72rem] font-medium tracking-[0.14em] uppercase underline-offset-4 hover:underline">
          View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [feed, spotlights, settings, categories, brands] = await Promise.all([
    personalisedFeed(user?.id ?? null, 40),
    spotlightWardrobes(),
    getSettings(),
    getTopCategories(),
    popularBrands(12),
  ]);
  const covers = await categoryCovers(categories.map((c) => c.id));
  const withPhotos = feed.filter((l) => l.photos[0]);
  const heroTiles = withPhotos.slice(0, 4);
  const sellTiles = withPhotos.slice(4, 7);

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

      {/* Hero: full-bleed editorial split */}
      <section aria-labelledby="hero-title" className="grid lg:min-h-[min(78vh,760px)] lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-brand-600 px-6 py-16 text-white sm:px-12 lg:px-16 xl:px-24">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-[#e2c9a0] uppercase">
            {user ? `Welcome back, ${user.name.split(" ")[0]}` : "The UK's considered resale marketplace"}
          </p>
          <h1 id="hero-title" className="mt-6 text-[clamp(2.9rem,5.6vw,5.4rem)] leading-[1] text-white">
            Pre-loved,
            <br />
            <em style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>beautifully</em>
            <br />
            passed on.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-brand-100">
            One-of-a-kind pieces from wardrobes across the UK. Every order covered by Buyer Protection.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/search?sort=newest" className="btn bg-white px-9 text-brand-700 hover:bg-brand-50">Shop new in</Link>
            <Link href="/sell" className="btn border-white/60 px-9 text-white hover:border-white hover:bg-white/10">Sell an item</Link>
          </div>
        </div>
        {heroTiles.length === 4 && (
          <ul className="grid grid-cols-2 gap-px bg-line" role="list" aria-label="Just listed">
            {heroTiles.map((l, i) => (
              <li key={l.id} className="group relative overflow-hidden bg-[#f2f1ee]">
                <Link href={listingPath(l)} className="block h-full">
                  <ListingPhoto photo={l.photos[0]} alt="" priority={i < 2} sizes="(min-width: 1024px) 25vw, 50vw" className="h-full min-h-[44vw] w-full transition-transform duration-700 ease-out group-hover:scale-[1.04] lg:min-h-0" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 pt-10 pb-3 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {l.title}
                  </span>
                  <span className="sr-only">{l.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Categories: edge-to-edge image row */}
      <section className="mt-20" aria-labelledby="cat-title">
        <Heading id="cat-title" eyebrow="Browse" title="Shop by category" />
        <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6" role="list">
          {categories.map((c) => {
            const cover = covers.get(c.id);
            return (
              <li key={c.id} className="bg-canvas">
                <Link href={`/c/${c.path}`} className="group block">
                  <span className="block overflow-hidden bg-[#f2f1ee]">
                    {cover ? (
                      <ListingPhoto photo={cover} alt="" sizes="(min-width: 1024px) 17vw, 50vw" className="aspect-square w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                    ) : (
                      <span className="block aspect-square" />
                    )}
                  </span>
                  <span className="block py-4 text-center text-[0.72rem] font-medium tracking-[0.18em] uppercase group-hover:underline group-hover:underline-offset-4">{c.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* New in */}
      <section className="container-page mt-24" aria-labelledby="feed-title">
        <Heading
          id="feed-title"
          eyebrow={user?.allowPersonalisation ? "Curated for you" : "Just arrived"}
          title={user?.allowPersonalisation ? "Picked for you" : "New in"}
          href="/search?sort=newest"
        />
        {user && user.allowPersonalisation && user.preferredSizeIds.length === 0 && (
          <p className="mx-auto mb-10 max-w-2xl border-y border-line py-4 text-center text-sm">
            Tell us your sizes and favourite brands to tailor this selection.{" "}
            <Link href="/settings/personalisation" className="link">Personalise</Link>
          </p>
        )}
        <ListingGrid listings={feed.slice(0, 20)} gridClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-5" empty="Nothing listed yet – be the first to sell something." />
        <div className="mt-14 text-center">
          <Link href="/search?sort=newest" className="btn-secondary px-10">Discover more</Link>
        </div>
      </section>

      {/* Shop by price: a quiet typographic band */}
      <section className="mt-24 border-y border-line bg-surface" aria-labelledby="price-title">
        <h2 id="price-title" className="sr-only">Shop by price</h2>
        <ul className="grid grid-cols-2 sm:grid-cols-4" role="list">
          {PRICE_BANDS.map((p, i) => (
            <li key={p} className={`${i > 0 ? "sm:border-l" : ""} ${i % 2 === 1 ? "border-l sm:border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} border-line`}>
              <Link href={`/search?priceMax=${p}&sort=newest`} className="group flex flex-col items-center py-10 transition-colors hover:bg-canvas">
                <span className="text-[0.7rem] font-medium tracking-[0.18em] text-muted uppercase">Under</span>
                <span className="mt-1 font-display text-5xl text-brand-600 group-hover:italic" style={{ fontVariationSettings: '"opsz" 144' }}>£{p}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Sell with us: editorial split */}
      <section className="mt-24 grid lg:grid-cols-2" aria-labelledby="sellers-title">
        {sellTiles.length === 3 && (
          <div className="grid grid-cols-2 gap-px bg-line" aria-hidden="true">
            <div className="row-span-2 overflow-hidden bg-[#f2f1ee]">
              <ListingPhoto photo={sellTiles[0].photos[0]} alt="" sizes="25vw" className="h-full w-full" />
            </div>
            <div className="overflow-hidden bg-[#f2f1ee]">
              <ListingPhoto photo={sellTiles[1].photos[0]} alt="" sizes="25vw" className="aspect-square h-full w-full" />
            </div>
            <div className="overflow-hidden bg-[#f2f1ee]">
              <ListingPhoto photo={sellTiles[2].photos[0]} alt="" sizes="25vw" className="aspect-square h-full w-full" />
            </div>
          </div>
        )}
        <div className="flex flex-col justify-center bg-accent-300 px-6 py-16 sm:px-12 lg:px-16 xl:px-24">
          <p className="eyebrow">For sellers &amp; resellers</p>
          <h2 id="sellers-title" className="mt-5 text-5xl leading-[1.05] sm:text-6xl">
            Your wardrobe, <em style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>reimagined</em> as income.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            From a single jacket to a full stockroom: list in minutes, keep every penny of your sale price, and get paid straight to your UK bank.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-3 border-t border-line pt-6">
            {[
              ["0%", "selling fees"],
              ["20", "photos per item"],
              ["2 days", "to get paid*"],
            ].map(([big, small]) => (
              <div key={small}>
                <dt className="sr-only">{small}</dt>
                <dd>
                  <span className="block font-display text-3xl text-brand-600">{big}</span>
                  <span className="text-xs text-muted">{small}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">*after delivery, if the buyer reports no problem.</p>
          <div className="mt-8">
            <Link href="/sell" className="btn-primary px-10">Start selling</Link>
          </div>
        </div>
      </section>

      {brands.length > 0 && (
        <section className="container-page mt-24" aria-labelledby="brand-title">
          <Heading id="brand-title" eyebrow="In demand" title="Popular brands" />
          <ul className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-10 gap-y-4" role="list">
            {brands.map((b) => (
              <li key={b.id}>
                <Link href={`/brands/${b.slug}`} className="font-display text-2xl text-ink/80 underline-offset-8 transition-colors hover:text-brand-600 hover:underline">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {spotlights.length > 0 && (
        <section className="container-page mt-24" aria-labelledby="spotlight-title">
          <Heading id="spotlight-title" eyebrow="Featured sellers" title="Wardrobe spotlight" />
          <div className="grid gap-10 md:grid-cols-2">
            {spotlights.map((s) => (
              <div key={s.id}>
                <Link href={`/members/${s.username}`} className="flex items-center gap-3">
                  <Avatar name={s.name} image={s.image} size={44} />
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="text-xs text-muted">@{s.username}</span>
                  </span>
                </Link>
                <ul className="mt-4 grid grid-cols-4 gap-3" role="list">
                  {s.listings.map((l) => (
                    <li key={l.id}>
                      <ListingCard listing={l} fees={settings} favourited={false} signedIn={!!user} compact />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
