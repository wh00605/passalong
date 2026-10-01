"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const MODES = {
  buy: {
    lede: "One-offs from real wardrobes across the UK. Every order is covered by Buyer Protection.",
    points: ["Money held until it arrives as described", "Tracked delivery or meet in person", "Make offers, bundle and save"],
    cta: { href: "/search?sort=newest", label: "Start browsing" },
  },
  sell: {
    lede: "Snap it, price it, post it. Keep every penny of your sale price – buyers cover the protection fee.",
    points: ["No listing or selling fees", "Prepaid label generated for you", "Paid out to your UK bank"],
    cta: { href: "/sell", label: "List your first item" },
  },
} as const;

export function HeroSwitch() {
  const [mode, setMode] = useState<keyof typeof MODES>("buy");
  const m = MODES[mode];
  return (
    <div className="rounded-md border-2 border-ink bg-surface p-5 shadow-[var(--shadow-tag)] sm:p-6">
      <div role="group" aria-label="I want to" className="inline-flex rounded-md border-2 border-ink p-0.5">
        {(["buy", "sell"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            onClick={() => setMode(k)}
            className={`min-h-10 rounded-[4px] px-5 text-sm font-bold capitalize transition-colors ${mode === k ? "bg-ink text-surface" : "hover:bg-brand-50"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        <p className="mt-4 text-lg leading-snug">{m.lede}</p>
        <ul className="mt-4 space-y-2 text-sm" role="list">
          {m.points.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-accent-400" aria-hidden="true">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <Link href={m.cta.href} className="btn-primary mt-6 w-full">
          {m.cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
