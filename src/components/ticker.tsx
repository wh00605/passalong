"use client";
import { useState } from "react";
import { Pause, Play } from "lucide-react";

/** Scrolling strip. Pausable (WCAG 2.2.2) and static when reduced motion is requested. */
export function Ticker({ items }: { items: string[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="relative flex items-center overflow-hidden border-t-2 border-ink bg-ink text-surface">
      <p className="sr-only">{items.join(". ")}</p>
      <div className="flex-1 overflow-hidden py-2.5" aria-hidden="true">
        <ul
          className="flex w-max animate-marquee gap-10 pr-10 font-mono text-sm tracking-[0.12em] uppercase motion-reduce:animate-none"
          style={{ animationPlayState: paused ? "paused" : "running" }}
        >
          {[...items, ...items].map((t, i) => (
            <li key={i} className="flex items-center gap-10">
              {t}
              <span className="h-2 w-2 rotate-45 bg-accent-400" />
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="mx-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-surface/40 hover:bg-accent-400 hover:text-ink motion-reduce:hidden"
        aria-label={paused ? "Play scrolling banner" : "Pause scrolling banner"}
      >
        {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
