import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ListingGrid } from "@/components/listing-grid";
import { ListingCard } from "@/components/listing-card";
import { Avatar } from "@/components/avatar";
import { HeroSwitch } from "@/components/hero-switch";
import { Ticker } from "@/components/ticker";
import { getCurrentUser } from "@/lib/session";
import { personalisedFeed, popularBrands, spotlightWardrobes } from "@/lib/listings";
import { getTopCategories } from "@/lib/catalogue";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";

const TICKER = ["0% selling fees", "Buyer Protection on every order", "Prepaid labels from £2.99", "Bundle discounts", "Paid out to your bank"];
const PRICE_BANDS = [10, 20, 50, 100];

function SectionHeading({ id, index, title, href, linkLabel = "See all" }: { id: string; index: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-ink pb-2">
      <h2 id={id} className="flex items-baseline gap-3 text-2xl font-extrabold sm:text-3xl">
        <span className="font-mono text-sm font-medium text-muted" aria-hidden="true">{index}</span>
        {title}
      </h2>
      {href && (
        <Link href={href} className="group inline-flex min-h-10 items-center gap-1 text-sm font-semibold">
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
    popularBrands(10),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Passalong",
    url: siteUrl,
    potentialAction: { "@type": "SearchAction", target: `${siteUrl}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };

  let n = 0;
  const idx = () => String(++n).padStart(2, "0");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {!user && (
        <section aria-labelledby="hero-title" className="border-b-2 border-ink">
          <div className="container-page grid gap-8 py-10 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className="eyebrow">Pre-loved · UK-wide · Since 2026</p>
              <h1 id="hero-title" className="mt-4 text-[clamp(2.6rem,7vw,5.5rem)] leading-[0.92] font-extrabold tracking-[-0.045em]">
                Good stuff
                <br />
                deserves a{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">second round.</span>
                  <span aria-hidden="true" className="absolute inset-x-[-0.1em] bottom-[0.08em] z-0 h-[0.38em] -rotate-1 bg-accent-400" />
                </span>
              </h1>
            </div>
            <HeroSwitch />
          </div>
          <Ticker items={TICKER} />
        </section>
      )}

      <section className="container-page mt-10" aria-labelledby="cat-title">
        <SectionHeading id="cat-title" index={idx()} title="Shop by category" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="list">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.path}`}
                className={`group flex aspect-[5/4] flex-col justify-between rounded-md border-2 border-ink p-4 transition-[transform,box-shadow] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[var(--shadow-tag)] ${i === 0 ? "bg-accent-400" : i === 3 ? "bg-ink text-surface" : "bg-surface"}`}
              >
                <span className="font-mono text-xs opacity-70">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex items-end justify-between">
                  <span className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{c.name}</span>
                  <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page mt-12" aria-labelledby="feed-title">
        <SectionHeading id="feed-title" index={idx()} title={user?.allowPersonalisation ? "Picked for you" : "Just listed"} href="/search?sort=newest" />
        {user && user.allowPersonalisation && user.preferredSizeIds.length === 0 && (
          <p className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-dashed border-ink p-4 text-sm">
            <span>Tell us your sizes and favourite brands and your feed gets a lot more <em>you</em>.</span>
            <Link href="/settings/personalisation" className="btn-accent btn-sm">Personalise</Link>
          </p>
        )}
        <ListingGrid listings={feed} empty="Nothing listed yet – be the first to sell something!" />
      </section>

      <section className="container-page mt-12" aria-labelledby="price-title">
        <SectionHeading id="price-title" index={idx()} title="Shop by price" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="list">
          {PRICE_BANDS.map((p) => (
            <li key={p}>
              <Link
                href={`/search?priceMax=${p}&sort=newest`}
                className="flex items-baseline justify-between rounded-md border-2 border-ink bg-surface px-4 py-5 transition-colors hover:bg-accent-400"
              >
                <span className="font-mono text-sm">Under</span>
                <span className="font-display text-4xl font-extrabold tracking-tight">£{p}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {brands.length > 0 && (
        <section className="container-page mt-12" aria-labelledby="brand-title">
          <SectionHeading id="brand-title" index={idx()} title="Popular brands" />
          <ul className="flex flex-wrap gap-2" role="list">
            {brands.map((b) => (
              <li key={b.id}>
                <Link href={`/brands/${b.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 font-semibold hover:bg-ink hover:text-surface">
                  {b.name}
                  <span className="font-mono text-xs opacity-70">{b.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {spotlights.length > 0 && (
        <section className="container-page mt-12" aria-labelledby="spotlight-title">
          <SectionHeading id="spotlight-title" index={idx()} title="Wardrobe spotlight" />
          <div className="grid gap-4 md:grid-cols-2">
            {spotlights.map((s) => (
              <div key={s.id} className="card p-4">
                <Link href={`/members/${s.username}`} className="flex items-center gap-3">
                  <Avatar name={s.name} image={s.image} size={40} />
                  <span>
                    <span className="block font-semibold">{s.name}</span>
                    <span className="font-mono text-xs text-muted">@{s.username}</span>
                  </span>
                </Link>
                <ul className="mt-3 grid grid-cols-4 gap-2" role="list">
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

      <section className="container-page mt-14" aria-labelledby="sellers-title">
        <div className="grid overflow-hidden rounded-md border-2 border-ink bg-ink text-surface md:grid-cols-[1.3fr_1fr]">
          <div className="p-6 sm:p-10">
            <p className="font-mono text-xs tracking-[0.14em] text-accent-400 uppercase">For sellers & resellers</p>
            <h2 id="sellers-title" className="mt-3 text-3xl leading-tight font-extrabold sm:text-4xl">
              Turn your rail into revenue.
            </h2>
            <p className="mt-3 max-w-lg text-brand-100">
              Whether it&apos;s one jacket or a whole stockroom: list in minutes, keep 100% of your sale price, and get paid straight to your UK bank account.
            </p>
            <Link href="/sell" className="btn-accent mt-6">
              List an item <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid grid-cols-2 border-t-2 border-surface/20 md:border-t-0 md:border-l-2" role="list">
            {[
              ["0%", "selling fees"],
              ["20", "photos per listing"],
              ["Bundles", "automatic multi-buy discounts"],
              ["Bump", "boost items to the top"],
            ].map(([big, small], i) => (
              <li key={big} className={`p-5 sm:p-6 ${i % 2 === 0 ? "border-r-2 border-surface/20" : ""} ${i < 2 ? "border-b-2 border-surface/20" : ""}`}>
                <span className="block font-display text-3xl font-extrabold text-accent-400">{big}</span>
                <span className="text-sm text-brand-100">{small}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
