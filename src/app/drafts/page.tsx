import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ListingPhoto } from "@/components/listing-card";
import { timeAgo } from "@/lib/time";
import { formatPence } from "@/lib/money";

export const metadata: Metadata = { title: "My items", robots: { index: false } };

const TABS = [
  ["DRAFT", "Drafts"],
  ["ACTIVE", "Live"],
  ["RESERVED", "Reserved"],
  ["HIDDEN", "Hidden"],
  ["SOLD", "Sold"],
] as const;

export default async function DraftsPage({ searchParams }: PageProps<"/drafts">) {
  const user = await requireUser("/drafts");
  const sp = await searchParams;
  const status = (TABS.find(([s]) => s === sp.status)?.[0] ?? "DRAFT") as (typeof TABS)[number][0];
  const [items, counts, pending] = await Promise.all([
    db.listing.findMany({
      where: { sellerId: user.id, status },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, pricePence: true, updatedAt: true, moderationStatus: true, photos: { orderBy: { position: "asc" }, take: 1 } },
    }),
    db.listing.groupBy({ by: ["status"], where: { sellerId: user.id }, _count: { _all: true } }),
    db.listing.count({ where: { sellerId: user.id, moderationStatus: "PENDING_REVIEW", status: { not: "DELETED" } } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <h1 className="text-4xl font-medium">My items</h1>
        <Link href="/sell" className="btn-accent">List an item</Link>
      </div>
      {pending > 0 && (
        <p className="mt-4 rounded-none border border-line bg-accent-300 p-3 text-sm">
          {pending} item{pending > 1 ? "s are" : " is"} being checked by our team and will go live once approved.
        </p>
      )}
      <nav aria-label="Item status" className="mt-4 flex gap-2 overflow-x-auto">
        {TABS.map(([s, label]) => (
          <Link key={s} href={`/drafts?status=${s}`} aria-current={s === status ? "page" : undefined} className={`btn btn-sm shrink-0 ${s === status ? "bg-brand-600 text-white" : "bg-surface"}`}>
            {label} <span className="font-mono text-xs opacity-70">{count(s)}</span>
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="mt-8 text-muted">Nothing here.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line" role="list">
          {items.map((l) => (
            <li key={l.id} className="flex items-center gap-4 py-3">
              <ListingPhoto photo={l.photos[0]} alt="" className="h-20 w-16 shrink-0 rounded-none border border-line" sizes="64px" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.title || "Untitled draft"}</p>
                <p className="font-mono text-xs text-muted">
                  {l.pricePence ? formatPence(l.pricePence) : "No price"} · updated {timeAgo(l.updatedAt)}
                  {l.moderationStatus === "PENDING_REVIEW" && " · in review"}
                </p>
              </div>
              <Link href={status === "DRAFT" ? `/items/${l.id}/edit` : `/items/${l.id}`} className="btn-secondary btn-sm">
                {status === "DRAFT" ? "Continue" : "View"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
