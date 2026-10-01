import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL } from "@/content/legal";
import { Markdown } from "@/components/markdown";
import { CookieSettingsButton } from "@/app/settings/privacy/cookie-settings-button";
import { DraftBanner } from "../draft-banner";

export function generateStaticParams() {
  return Object.keys(LEGAL).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const doc = LEGAL[(await params).slug];
  return doc ? { title: doc.title, description: doc.summary, alternates: { canonical: `/legal/${(await params).slug}` } } : { title: "Not found" };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  const doc = LEGAL[slug];
  if (!doc) notFound();
  return (
    <div className="container-page max-w-3xl py-10">
      <DraftBanner />
      <p className="eyebrow mt-6">Legal</p>
      <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">{doc.title}</h1>
      <p className="mt-1 font-mono text-xs text-muted">Last updated {doc.updated}</p>
      <article className="mt-8"><Markdown source={doc.body} /></article>
      {slug === "cookies" && (
        <section id="manage" className="mt-8 rounded-md border-2 border-ink p-5">
          <h2 className="text-xl font-extrabold">Your cookie choices</h2>
          <CookieSettingsButton />
        </section>
      )}
      <nav aria-label="Other policies" className="mt-12 border-t-2 border-ink pt-4 text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(LEGAL).filter(([s]) => s !== slug).map(([s, d]) => <li key={s}><Link href={`/legal/${s}`} className="link">{d.title}</Link></li>)}
          <li><Link href="/legal/prohibited-items" className="link">Prohibited items</Link></li>
        </ul>
      </nav>
    </div>
  );
}
