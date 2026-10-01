import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { toQueryString } from "@/lib/search-params";
import type { SearchParams } from "@/lib/listings";
import { timeAgo } from "@/lib/time";
import { SavedSearchControls } from "./controls";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false } };

export default async function SavedSearchesPage() {
  const user = await requireUser("/saved-searches");
  const items = await db.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="border-b border-line pb-3 text-4xl font-medium">Saved searches</h1>
      <p className="mt-3 text-sm text-muted">With alerts on, we&apos;ll notify you when new items match – at most once a day per search.</p>
      {items.length === 0 ? (
        <p className="mt-8 text-muted">
          No saved searches. Run a <Link href="/search" className="link">search</Link> and tap “Save search”.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line" role="list">
          {items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link href={`/search?${toQueryString(s.filters as SearchParams)}`} className="font-semibold hover:underline">{s.name}</Link>
                <p className="font-mono text-xs text-muted">Saved {timeAgo(s.createdAt)}</p>
              </div>
              <SavedSearchControls id={s.id} alerts={s.alertsEnabled} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
