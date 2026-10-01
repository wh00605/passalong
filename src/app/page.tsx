import Link from "next/link";
import { ArrowRight, ArrowUpRight, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { ListingGrid } from "@/components/listing-grid";
import { ListingCard, ListingPhoto } from "@/components/listing-card";
import { Avatar } from "@/components/avatar";
import { getCurrentUser } from "@/lib/session";
import { personalisedFeed, popularBrands, spotlightWardrobes } from "@/lib/listings";
import { getTopCategories } from "@/lib/catalogue";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";
import { formatPence } from "@/lib/money";

const PRICE_BANDS = [10, 20, 50, 100];
const CATEGORY_TONES = ["bg-[#efe9df]", "bg-[#e6e4f1]", "bg-[#ece5e1]", "bg-[#e5eae4]", "bg-[#f1ebe2]", "bg-[#e9e6ef]"];

function SectionHeading({ id, eyebrow, title, href, linkLabel = "View all" }: { id: string; eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 id={id} className="text-3xl sm:text-4xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-brand-600">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [feed, spotlights, settings, categories, brands] = await Promise.all([
    personalisedFeed(user?.id ?? null),
    spotlightWardrobes(),
    getSettings(),
    getTopCategories(),
    popularBrands(12),
  ]);
  const mosaic = feed.filter((l) => l.photos[0]).slice(0, 3);

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

      {user ? (
        <section aria-labelledby="hello-title" className="container-page pt-10 pb-2">
          <p className="eyebrow">Welcome back</p>
          <h1 id="hello-title" className="mt-2 text-4xl sm:text-5xl">
            Hello, {user.name.split(" ")[0]}<span className="text-brass">.</span>
          </h1>
        </section>
      ) : (
        <section aria-labelledby="hero-title" className="overflow-hidden">
          <div className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="eyebrow">The UK&apos;s considered resale marketplace</p>
              <h1 id="hero-title" className="mt-5 text-[clamp(2.8rem,6.2vw,5.2rem)] leading-[1.02]">
                Pre-loved, <em className="text-brand-600" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>beautifully</em> passed on.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Discover one-of-a-kind pieces from wardrobes across the UK – and give the things you no longer wear a second life.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/search?sort=newest" className="btn-primary px-8">Shop new arrivals</Link>
                <Link href="/sell" className="btn-secondary px-8">Start selling</Link>
              </div>
            </div>
            {mosaic.length === 3 && (
              <div className="relative hidden h-[30rem] lg:block" aria-hidden="true">
                <div className="absolute top-0 left-[8%] w-[46%] overflow-hidden rounded-[2rem] shadow-[var(--shadow-tag)]">
                  <ListingPhoto photo={mosaic[0].photos[0]} alt="" priority className="aspect-[4/5] w-full" sizes="280px" />
                </div>
                <div className="absolute top-[14%] right-0 w-[42%] overflow-hidden rounded-[2rem] shadow-[var(--shadow-tag)]">
                  <ListingPhoto photo={mosaic[1].photos[0]} alt="" priority className="aspect-[4/5] w-full" sizes="260px" />
                </div>
                <div className="absolute bottom-0 left-[30%] w-[36%] overflow-hidden rounded-[2rem] border-4 border-canvas shadow-[var(--shadow-tag)]">
                  <ListingPhoto photo={mosaic[2].photos[0]} alt="" className="aspect-square w-full" sizes="220px" />
                </div>
              </div>
            )}
          </div>
          <div className="border-y border-line bg-surface">
            <ul className="container-page grid gap-6 py-7 text-sm sm:grid-cols-3" role="list">
              {[
                [ShieldCheck, "Buyer Protection on every order", "Your payment is held until your item arrives as described."],
                [Sparkles, "No selling fees", "Sellers keep 100% of the price they set."],
                [PackageCheck, `Tracked postage from ${formatPence(299)}`, "Prepaid labels, or meet in person."],
              ].map(([Icon, title, body]) => {
                const I = Icon as typeof ShieldCheck;
                return (
                  <li key={title as string} className="flex gap-3.5">
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-brass" strokeWidth={1.6} aria-hidden="true" />
                    <span>
                      <span className="block font-medium text-ink">{title as string}</span>
                      <span className="text-muted">{body as string}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section className="container-page mt-16" aria-labelledby="cat-title">
        <SectionHeading id="cat-title" eyebrow="Browse" title="Shop by category" />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" role="list">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.path}`}
                className={`group flex aspect-[5/4] flex-col justify-end rounded-2xl p-5 transition-shadow hover:shadow-[var(--shadow-tag)] ${CATEGORY_TONES[i % CATEGORY_TONES.length]}`}
              >
                <span className="flex flex-wrap items-end justify-between gap-2">
                  <span className="font-display text-xl leading-tight xl:text-2xl" style={{ fontVariationSettings: '"opsz" 72' }}>{c.name}</span>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface/80 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page mt-20" aria-labelledby="feed-title">
        <SectionHeading
          id="feed-title"
          eyebrow={user?.allowPersonalisation ? "Curated for you" : "Just arrived"}
          title={user?.allowPersonalisation ? "Picked for you" : "New in"}
          href="/search?sort=newest"
        />
        {user && user.allowPersonalisation && user.preferredSizeIds.length === 0 && (
          <p className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-300 px-6 py-4 text-sm">
            <span>Tell us your sizes and favourite brands, and we&apos;ll tailor this selection to you.</span>
            <Link href="/settings/personalisation" className="btn-secondary btn-sm">Personalise</Link>
          </p>
        )}
        <ListingGrid listings={feed.slice(0, 20)} gridClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-5" empty="Nothing listed yet – be the first to sell something." />
        {feed.length > 20 && (
          <div className="mt-12 text-center">
            <Link href="/search?sort=newest" className="btn-secondary px-8">Discover more</Link>
          </div>
        )}
      </section>

      <section className="container-page mt-20" aria-labelledby="price-title">
        <SectionHeading id="price-title" eyebrow="Within budget" title="Shop by price" />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4" role="list">
          {PRICE_BANDS.map((p) => (
            <li key={p}>
              <Link href={`/search?priceMax=${p}&sort=newest`} className="group flex flex-col rounded-2xl border border-line bg-surface px-6 py-6 transition-shadow hover:shadow-[var(--shadow-tag)]">
                <span className="text-sm text-muted">Under</span>
                <span className="font-display text-4xl text-brand-600" style={{ fontVariationSettings: '"opsz" 96' }}>£{p}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {brands.length > 0 && (
        <section className="container-page mt-20" aria-labelledby="brand-title">
          <SectionHeading id="brand-title" eyebrow="In demand" title="Popular brands" />
          <ul className="flex flex-wrap gap-x-8 gap-y-3" role="list">
            {brands.map((b) => (
              <li key={b.id}>
                <Link href={`/brands/${b.slug}`} className="font-display text-xl text-ink/80 underline-offset-8 transition-colors hover:text-brand-600 hover:underline sm:text-2xl">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {spotlights.length > 0 && (
        <section className="container-page mt-20" aria-labelledby="spotlight-title">
          <SectionHeading id="spotlight-title" eyebrow="Featured sellers" title="Wardrobe spotlight" />
          <div className="grid gap-6 md:grid-cols-2">
            {spotlights.map((s) => (
              <div key={s.id} className="card p-5">
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

      <section className="container-page mt-24" aria-labelledby="sellers-title">
        <div className="grid overflow-hidden rounded-[2rem] bg-brand-600 text-white md:grid-cols-[1.2fr_1fr]">
          <div className="p-8 sm:p-12">
            <p className="text-[0.7rem] font-medium tracking-[0.18em] text-[#e2c9a0] uppercase">For sellers &amp; resellers</p>
            <h2 id="sellers-title" className="mt-4 text-4xl leading-tight sm:text-5xl">
              Your wardrobe, <em style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>reimagined</em> as income.
            </h2>
            <p className="mt-4 max-w-md text-brand-100">
              From a single jacket to a full stockroom: list in minutes, keep every penny of your sale price, and get paid straight to your UK bank account.
            </p>
            <Link href="/sell" className="btn mt-8 bg-white px-8 text-brand-700 hover:bg-brand-50">
              List an item <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <dl className="grid grid-cols-2 border-t border-white/15 md:border-t-0 md:border-l">
            {[
              ["0%", "selling fees"],
              ["20", "photos per listing"],
              ["Bundles", "automatic multi-buy discounts"],
              ["Bump", "featured placement for 3 days"],
            ].map(([big, small], i) => (
              <div key={big} className={`p-6 sm:p-8 ${i % 2 === 0 ? "border-r border-white/15" : ""} ${i < 2 ? "border-b border-white/15" : ""}`}>
                <dt className="sr-only">{small}</dt>
                <dd>
                  <span className="block font-display text-4xl text-[#e2c9a0]">{big}</span>
                  <span className="text-sm text-brand-100">{small}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
