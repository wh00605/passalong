"use client";
import { useState } from "react";
import type { DayPoint } from "@/lib/analytics";
import { formatPence } from "@/lib/money";

/** Single-series daily bar chart with hover/focus tooltip and a table view. */
export function MiniBars({ title, data, kind = "count" }: { title: string; data: DayPoint[]; kind?: "count" | "money" }) {
  const format = (n: number) => (kind === "money" ? formatPence(n) : n.toLocaleString("en-GB"));
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 300;
  const H = 80;
  const gap = 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const total = data.reduce((a, d) => a + d.value, 0);
  const h = hover != null ? data[hover] : null;
  return (
    <figure className="card p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="font-mono text-xs text-muted">{h ? `${new Date(h.day).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${format(h.value)}` : `${data.length}d total ${format(total)}`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 1}`} className="mt-2 w-full" role="img" aria-label={`${title}, last ${data.length} days, total ${format(total)}`} onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="#ddd8cb" strokeWidth="1" />
        {data.map((d, i) => {
          const bh = (d.value / max) * (H - 4);
          const x = i * (bw + gap);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
              {bh > 0 && <rect x={x} y={H - bh} width={bw} height={bh} rx={Math.min(2, bw / 2)} fill={hover === i ? "#4f5f00" : "#121212"} />}
            </g>
          );
        })}
      </svg>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">Table view</summary>
        <table className="mt-2 w-full">
          <thead><tr><th scope="col" className="text-left">Day</th><th scope="col" className="text-right">{title}</th></tr></thead>
          <tbody>
            {data.filter((d) => d.value).map((d) => (
              <tr key={d.day}><td>{d.day}</td><td className="text-right font-mono">{format(d.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
