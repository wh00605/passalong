"use client";
import { useSelectedLayoutSegment } from "next/navigation";

/** Two panes on desktop; on phones show either the list or the open conversation. */
export function InboxShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const inThread = !!segment && segment !== "start";
  return (
    <div className="grid h-[calc(100dvh-11rem)] min-h-[480px] overflow-hidden rounded-md border-2 border-ink bg-surface md:grid-cols-[340px_1fr]">
      <div className={`min-h-0 overflow-y-auto border-ink md:border-r-2 ${inThread ? "max-md:hidden" : ""}`}>{list}</div>
      <div className={`min-h-0 ${inThread ? "" : "max-md:hidden"}`}>{children}</div>
    </div>
  );
}
