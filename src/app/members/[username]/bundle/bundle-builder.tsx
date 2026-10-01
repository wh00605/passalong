"use client";
import Link from "next/link";
import { useState } from "react";
import { formatPence } from "@/lib/money";
import { bundleDiscountPercent } from "@/lib/fees";

type Item = { id: string; title: string; pricePence: number; size: string | null; thumb: string | null };

export function BundleBuilder({ items, tiers, isOwn, signedIn, fees }: { sellerId: string; items: Item[]; tiers: { minItems: number; percentOff: number }[]; isOwn: boolean; signedIn: boolean; fees: { fixed: number; bps: number } }) {
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = items.filter((i) => picked.includes(i.id));
  const subtotal = chosen.reduce((a, i) => a + i.pricePence, 0);
  const pct = bundleDiscountPercent(chosen.length, tiers, tiers.length > 0);
  const discount = Math.round((subtotal * pct) / 100);
  const protection = chosen.length ? fees.fixed + Math.round(((subtotal - discount) * fees.bps) / 10_000) : 0;
  const href = `/checkout/start?items=${picked.join(",")}`;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
      <fieldset>
        <legend className="sr-only">Choose items for your bundle</legend>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="list">
          {items.map((i) => {
            const on = picked.includes(i.id);
            return (
              <li key={i.id}>
                <label className={`block cursor-pointer overflow-hidden rounded-none border ${on ? "border-brand-600 shadow-[var(--shadow-tag)]" : "border-ink/30"}`}>
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== i.id) : [...picked, i.id].slice(0, 20))} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.thumb ? <img src={i.thumb} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" /> : <span className="block aspect-[4/5] bg-brand-50" />}
                  <span className={`block p-2 text-sm peer-focus-visible:outline-3 ${on ? "bg-accent-400" : "bg-surface"}`}>
                    <span className="line-clamp-1 font-semibold">{i.title}</span>
                    <span className="font-mono text-xs">{formatPence(i.pricePence)}{i.size ? ` · ${i.size}` : ""}</span>
                    <span className="sr-only">{on ? " (in bundle)" : ""}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <aside className="card h-fit space-y-2 p-5 lg:sticky lg:top-28" aria-live="polite">
        <h2 className="text-lg font-bold">Your bundle</h2>
        <p className="text-sm">{chosen.length} item{chosen.length === 1 ? "" : "s"}</p>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Items</dt><dd className="font-mono">{formatPence(subtotal)}</dd></div>
          {discount > 0 && <div className="flex justify-between"><dt>Bundle discount ({pct}%)</dt><dd className="font-mono">−{formatPence(discount)}</dd></div>}
          <div className="flex justify-between"><dt>Buyer Protection</dt><dd className="font-mono">{formatPence(protection)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Postage</dt><dd>at checkout</dd></div>
        </dl>
        {isOwn ? (
          <p className="text-sm text-muted">This is your own wardrobe.</p>
        ) : chosen.length === 0 ? (
          <button type="button" className="btn-primary w-full" disabled>Choose items</button>
        ) : (
          <Link href={signedIn ? href : `/login?next=${encodeURIComponent(href)}`} className="btn-primary w-full">Buy bundle</Link>
        )}
        <p className="text-xs text-muted">Want a better price? Message the seller from any item to make an offer.</p>
      </aside>
    </div>
  );
}
