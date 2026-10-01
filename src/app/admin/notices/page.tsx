import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { AdminAction } from "../admin-action";
import { decideNoticeAction } from "../actions";

export const metadata = { title: "Illegal content notices" };

export default async function NoticesPage() {
  const notices = await db.illegalContentNotice.findMany({ orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: 200 });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium">Illegal content notices</h1>
      <p className="max-w-2xl text-sm text-muted">
        Notices submitted under our notice-and-action process (EU DSA Art. 16 / UK Online Safety Act). Decide promptly, record your reasons, and – if you restrict content – also remove or hide it from the moderation tools. The notifier is emailed your decision.
      </p>
      {notices.length === 0 && <p className="text-muted">No notices received.</p>}
      <ul className="space-y-3" role="list">
        {notices.map((n) => (
          <li key={n.id} className="card space-y-2 p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="tag text-xs">{n.status}</span>
              <span className="font-mono text-xs text-muted">{formatDateTime(n.createdAt)} · from {n.reporterName} &lt;{n.reporterEmail}&gt;</span>
            </p>
            <p className="text-sm break-all">Content: <a href={n.contentUrl} className="link" target="_blank" rel="noreferrer">{n.contentUrl}</a></p>
            <p className="text-sm"><strong>Legal basis:</strong> {n.legalBasis}</p>
            <p className="text-sm">{n.explanation}</p>
            {n.decision && <p className="text-sm">Decision: {n.decision} – {n.decisionReason}</p>}
            {["RECEIVED", "UNDER_REVIEW"].includes(n.status) && (
              <div className="flex flex-wrap gap-2">
                <AdminAction action={decideNoticeAction.bind(null, n.id, "ACTIONED")} label="Content restricted" fields={["reason"]} danger />
                <AdminAction action={decideNoticeAction.bind(null, n.id, "REJECTED")} label="No action" fields={["reason"]} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
