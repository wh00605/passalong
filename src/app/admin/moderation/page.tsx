import Link from "next/link";
import { db } from "@/lib/db";
import { listingPath } from "@/lib/slug";
import { timeAgo } from "@/lib/time";
import { formatPence } from "@/lib/money";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { AdminAction } from "../admin-action";
import { dismissReportAction, moderateListingAction, moderateUserAction, hideMessageAction, resolveFraudSignalAction } from "../actions";

export const metadata = { title: "Moderation" };

const reasonLabel = (type: keyof typeof REPORT_REASONS, r: string) => (REPORT_REASONS[type] as readonly (readonly [string, string])[]).find(([v]) => v === r)?.[1] ?? r;

export default async function ModerationPage({ searchParams }: PageProps<"/admin/moderation">) {
  const sp = await searchParams;
  const tab = sp.tab === "listings" ? "listings" : sp.tab === "fraud" ? "fraud" : "reports";
  const tabs = [["reports", "Reports"], ["listings", "Listings in review"], ["fraud", "Fraud signals"]] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium">Moderation queue</h1>
      <nav aria-label="Queues" className="flex gap-2">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/admin/moderation?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`btn btn-sm ${tab === k ? "bg-brand-600 text-white" : "bg-surface"}`}>{l}</Link>
        ))}
      </nav>
      {tab === "reports" && <Reports />}
      {tab === "listings" && <PendingListings />}
      {tab === "fraud" && <Fraud />}
    </div>
  );
}

async function Reports() {
  const reports = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      reporter: { select: { username: true } },
      listing: { select: { id: true, title: true, status: true, sellerId: true, seller: { select: { username: true } } } },
      user: { select: { id: true, username: true, warningCount: true, banned: true } },
      message: { select: { id: true, body: true, conversationId: true } },
    },
  });
  if (!reports.length) return <p className="text-muted">No open reports. 🎉</p>;
  return (
    <ul className="space-y-3" role="list">
      {reports.map((r) => (
        <li key={r.id} className="card space-y-2 p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="tag text-xs">{r.targetType}</span>
            <strong>{reasonLabel(r.targetType, r.reason)}</strong>
            <span className="font-mono text-xs text-muted">by @{r.reporter.username} · {timeAgo(r.createdAt)}</span>
          </p>
          {r.details && <p className="text-sm italic">“{r.details}”</p>}
          {r.listing && <p className="text-sm">Item: <Link href={listingPath(r.listing)} className="link" target="_blank">{r.listing.title}</Link> by <Link href={`/admin/users?q=${r.listing.seller.username}`} className="link">@{r.listing.seller.username}</Link></p>}
          {r.message && <p className="rounded-none bg-brand-50 p-2 text-sm">Message: “{r.message.body.slice(0, 400)}”</p>}
          {r.user && <p className="text-sm">Member: <Link href={`/admin/users/${r.user.id}`} className="link">@{r.user.username}</Link> · {r.user.warningCount} warning(s){r.user.banned ? " · restricted" : ""}</p>}
          <div className="flex flex-wrap gap-2">
            {r.listing && <AdminAction action={moderateListingAction.bind(null, r.listing.id, "remove", r.id)} label="Remove item" fields={["reason"]} danger />}
            {r.message && <AdminAction action={hideMessageAction.bind(null, r.message.id, r.id)} label="Hide message" fields={["reason"]} danger />}
            {r.user && (
              <>
                <AdminAction action={moderateUserAction.bind(null, r.user.id, "warn", r.id)} label="Warn" fields={["reason"]} />
                <AdminAction action={moderateUserAction.bind(null, r.user.id, "suspend", r.id)} label="Suspend" fields={["reason", "days"]} danger />
              </>
            )}
            <AdminAction action={dismissReportAction.bind(null, r.id)} label="Dismiss" className="btn-ghost btn-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function PendingListings() {
  const listings = await db.listing.findMany({
    where: { moderationStatus: "PENDING_REVIEW", status: { not: "DELETED" } },
    orderBy: { updatedAt: "asc" },
    take: 100,
    include: { seller: { select: { id: true, username: true, createdAt: true } } },
  });
  if (!listings.length) return <p className="text-muted">Nothing waiting for review.</p>;
  return (
    <ul className="space-y-3" role="list">
      {listings.map((l) => (
        <li key={l.id} className="card space-y-2 p-4">
          <p className="font-semibold"><Link href={listingPath(l)} className="link" target="_blank">{l.title}</Link> · <span className="font-mono">{formatPence(l.pricePence)}</span></p>
          <p className="text-sm text-muted">{l.moderationNote}</p>
          <p className="line-clamp-3 text-sm">{l.description}</p>
          <p className="font-mono text-xs text-muted">@{l.seller.username} · member since {timeAgo(l.seller.createdAt)}</p>
          <div className="flex flex-wrap gap-2">
            <AdminAction action={moderateListingAction.bind(null, l.id, "approve", undefined)} label="Approve" className="btn-accent btn-sm" />
            <AdminAction action={moderateListingAction.bind(null, l.id, "remove", undefined)} label="Remove" fields={["reason"]} danger />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Fraud() {
  const signals = await db.fraudSignal.findMany({ where: { resolvedAt: null }, orderBy: [{ score: "desc" }, { createdAt: "asc" }], take: 100, include: { user: { select: { id: true, username: true, createdAt: true, banned: true } } } });
  if (!signals.length) return <p className="text-muted">No open fraud signals.</p>;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Open fraud signals</caption>
      <thead><tr className="text-left font-mono text-xs uppercase"><th scope="col">Member</th><th scope="col">Signal</th><th scope="col">Score</th><th scope="col">Details</th><th scope="col">Actions</th></tr></thead>
      <tbody className="divide-y divide-line">
        {signals.map((s) => (
          <tr key={s.id} className="align-top">
            <td className="py-2"><Link href={`/admin/users/${s.user.id}`} className="link">@{s.user.username}</Link><span className="block text-xs text-muted">joined {timeAgo(s.user.createdAt)}</span></td>
            <td className="py-2 font-mono text-xs">{s.type}</td>
            <td className="py-2 font-mono">{s.score}</td>
            <td className="py-2 font-mono text-xs break-all">{JSON.stringify(s.details)}</td>
            <td className="space-x-1 py-2">
              <AdminAction action={resolveFraudSignalAction.bind(null, s.id)} label="Clear" className="btn-ghost btn-sm" />
              {!s.user.banned && <AdminAction action={moderateUserAction.bind(null, s.user.id, "suspend", undefined)} label="Suspend" fields={["reason", "days"]} danger />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
