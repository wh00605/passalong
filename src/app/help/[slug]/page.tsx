import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Markdown } from "@/components/markdown";
import { formatDate } from "@/lib/time";
import { siteUrl } from "@/lib/env";

async function load(slug: string) {
  return db.helpArticle.findFirst({ where: { slug, published: true } });
}

export async function generateMetadata({ params }: PageProps<"/help/[slug]">): Promise<Metadata> {
  const a = await load((await params).slug);
  return a ? { title: a.title, description: a.body.replace(/[#*[\]()]/g, "").slice(0, 155), alternates: { canonical: `/help/${a.slug}` } } : { title: "Not found" };
}

export default async function HelpArticlePage({ params }: PageProps<"/help/[slug]">) {
  const a = await load((await params).slug);
  if (!a) notFound();
  const related = await db.helpArticle.findMany({ where: { category: a.category, published: true, id: { not: a.id } }, select: { slug: true, title: true }, take: 5 });
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: a.title, dateModified: a.updatedAt.toISOString(), url: `${siteUrl}/help/${a.slug}`, publisher: { "@type": "Organization", name: "Passalong" } };
  return (
    <div className="container-page max-w-3xl py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted"><Link href="/help" className="hover:underline">Help centre</Link> / {a.category}</nav>
      <h1 className="mt-2 text-4xl font-medium">{a.title}</h1>
      <p className="mt-1 font-mono text-xs text-muted">Updated {formatDate(a.updatedAt)}</p>
      <article className="mt-6"><Markdown source={a.body} /></article>
      {related.length > 0 && (
        <aside className="mt-10 border-t border-line pt-4" aria-labelledby="related-h">
          <h2 id="related-h" className="text-lg font-bold">Related</h2>
          <ul className="mt-2 space-y-1">{related.map((r) => <li key={r.slug}><Link href={`/help/${r.slug}`} className="link">{r.title}</Link></li>)}</ul>
        </aside>
      )}
      <p className="mt-8 text-sm">Didn&apos;t answer your question? <Link href="/contact" className="link">Contact us</Link></p>
    </div>
  );
}
