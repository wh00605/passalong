import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Help centre", description: "Answers about buying, selling, shipping, payments and safety on Passalong.", alternates: { canonical: "/help" } };

export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const articles = await db.helpArticle.findMany({
    where: { published: true, ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: { slug: true, title: true, category: true },
  });
  const byCat = articles.reduce<Record<string, typeof articles>>((acc, a) => ((acc[a.category] ??= []).push(a), acc), {});

  return (
    <div className="container-page max-w-4xl py-10">
      <p className="eyebrow">Help centre</p>
      <h1 className="mt-2 text-5xl font-medium">How can we help?</h1>
      <form role="search" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="help-q" className="sr-only">Search help articles</label>
        <input id="help-q" name="q" type="search" defaultValue={q} placeholder="e.g. refund, postage, offers" className="input" />
        <button type="submit" className="btn-primary">Search</button>
      </form>
      {q && <p className="mt-4 text-sm" aria-live="polite">{articles.length} result{articles.length === 1 ? "" : "s"} for “{q}”</p>}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {Object.entries(byCat).map(([cat, list]) => (
          <section key={cat} className="card p-5" aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="text-xl font-medium">{cat}</h2>
            <ul className="mt-3 space-y-1" role="list">
              {list.map((a) => (
                <li key={a.slug}><Link href={`/help/${a.slug}`} className="inline-flex min-h-9 items-center hover:underline">{a.title}</Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {articles.length === 0 && <p className="mt-6">No articles match. Try different words, or contact us.</p>}
      <section className="mt-10 rounded-none border border-line bg-accent-300 p-6" aria-labelledby="contact-h">
        <h2 id="contact-h" className="text-2xl font-medium">Still stuck?</h2>
        <p className="mt-1">Our team replies within 2 working days.</p>
        <Link href="/contact" className="btn-primary mt-4">Contact us</Link>
      </section>
    </div>
  );
}
