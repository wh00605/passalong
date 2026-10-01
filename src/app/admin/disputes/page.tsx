import Link from "next/link";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { timeAgo, formatDateTime } from "@/lib/time";
import { DISPUTE_STATUS_LABEL } from "@/lib/order-status";
import { REASON_LABELS } from "@/lib/disputes";
import { AdminAction } from "../admin-action";
import { resolveDisputeAction } from "../actions";

export const metadata = { title: "Disputes" };

export default async function AdminDisputes({ searchParams }: PageProps<"/admin/disputes">) {
  const sp = await searchParams;
  const all = sp.all === "1";
  const disputes = await db.dispute.findMany({
    where: all ? {} : { status: { in: ["ESCALATED", "AWAITING_SELLER", "AWAITING_BUYER", "RETURN_REQUESTED", "RETURN_IN_TRANSIT"] } },
    orderBy: [{ escalatedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 100,
    include: {
      order: { select: { id: true, number: true, totalPence: true, refundedPence: true, buyer: { select: { username: true } }, seller: { select: { username: true } } } },
      evidence: { select: { id: true, storageKey: true, note: true, uploaderId: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold">Disputes</h1>
        <Link href={all ? "/admin/disputes" : "/admin/disputes?all=1"} className="btn-ghost btn-sm">{all ? "Open only" : "Show all"}</Link>
      </div>
      {disputes.length === 0 && <p className="text-muted">No disputes.</p>}
      <ul className="space-y-4" role="list">
        {disputes.map((d) => (
          <li key={d.id} className={`card space-y-3 p-4 ${d.status === "ESCALATED" ? "border-hot" : ""}`}>
            <p className="flex flex-wrap items-center gap-2">
              <span className="tag text-xs">{DISPUTE_STATUS_LABEL[d.status]}</span>
              <strong>{REASON_LABELS[d.reason]}</strong>
              <Link href={`/admin/orders/${d.order.id}`} className="link font-mono text-sm">{d.order.number}</Link>
              <span className="font-mono text-xs text-muted">{formatPence(d.order.totalPence)} · opened {timeAgo(d.createdAt)}</span>
            </p>
            <p className="text-sm">Buyer @{d.order.buyer.username} → Seller @{d.order.seller.username}</p>
            <p className="text-sm">{d.description}</p>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">History & evidence ({d.events.length} events, {d.evidence.length} evidence)</summary>
              <ol className="mt-2 space-y-1 text-xs">
                {d.events.map((e) => <li key={e.id}><span className="font-mono text-muted">{formatDateTime(e.createdAt)}</span> {e.body}</li>)}
              </ol>
              <ul className="mt-2 flex flex-wrap gap-2">
                {d.evidence.map((ev) => (
                  <li key={ev.id} className="text-xs">
                    {ev.storageKey ? <a href={`/api/files/private/${ev.storageKey}-1280.webp`} target="_blank" rel="noreferrer" className="link">Photo ({ev.uploaderId === d.openedById ? "buyer" : "seller"})</a> : null} {ev.note}
                  </li>
                ))}
              </ul>
            </details>
            {!d.status.startsWith("RESOLVED") && d.status !== "CANCELLED" && (
              <div className="flex flex-wrap gap-2">
                <AdminAction action={resolveDisputeAction.bind(null, d.id, "refund", "")} label="Full refund" fields={["reason"]} danger />
                <AdminAction action={resolveDisputeAction.bind(null, d.id, "partial")} label="Partial refund" fields={["amount", "reason"]} />
                <AdminAction action={resolveDisputeAction.bind(null, d.id, "release", "")} label="Release to seller" fields={["reason"]} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
