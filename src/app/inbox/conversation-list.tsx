"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ListingThumb } from "@/components/chat/listing-thumb";
import { useLive } from "@/components/chat/use-live";

type Item = {
  id: string; otherName: string; otherImage: string | null; listingTitle: string; lastAt: string; unread: boolean; preview: string; mine: boolean;
  thumb: string | null;
};

function shortTime(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ConversationList({ items, userId }: { items: Item[]; userId: string }) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  useLive(`user:${userId}`, () => router.refresh(), { pollMs: 20_000 });
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted">No messages yet. Message a seller from any item page.</p>;
  }
  return (
    <nav aria-label="Conversations">
      <ul role="list">
        {items.map((c) => {
          const active = params.id === c.id;
          return (
            <li key={c.id} className="border-b border-line">
              <Link
                href={`/inbox/${c.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex gap-3 p-3 ${active ? "bg-accent-400" : "hover:bg-canvas"}`}
              >
                <ListingThumb src={c.thumb} className="h-14 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate ${c.unread ? "font-bold" : "font-semibold"}`}>{c.otherName}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">{shortTime(c.lastAt)}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">{c.listingTitle}</span>
                  <span className={`block truncate text-sm ${c.unread ? "font-semibold text-ink" : "text-muted"}`}>
                    {c.unread && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-hot" aria-hidden="true" />}
                    {c.unread && <span className="sr-only">Unread. </span>}
                    {c.mine && "You: "}
                    {c.preview}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
