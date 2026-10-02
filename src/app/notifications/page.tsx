import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { MarkAllRead } from "./mark-all-read";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="container-page max-w-3xl py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Notifications</h1>
        <div className="flex gap-2">
          {unread > 0 && <MarkAllRead />}
          <Link href="/settings/notifications" className="btn-ghost btn-sm">Settings</Link>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-8 text-muted">Nothing yet. We&apos;ll let you know about offers, orders and messages here.</p>
      ) : (
        <ul className="divide-y divide-line" role="list">
          {items.map((n) => {
            const body = (
              <>
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold">
                    {!n.readAt && <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-hot align-middle" aria-hidden="true" />}
                    {!n.readAt && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">{timeAgo(n.createdAt)}</span>
                </span>
                <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
              </>
            );
            return (
              <li key={n.id} className={n.readAt ? "" : "bg-surface"}>
                {n.url ? (
                  <Link href={`/notifications/${n.id}`} className="block px-3 py-4 hover:bg-brand-50/40">{body}</Link>
                ) : (
                  <div className="px-3 py-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
