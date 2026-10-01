import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { AdminAction } from "../admin-action";
import { closeTicketAction } from "../actions";

export const metadata = { title: "Support tickets" };

export default async function TicketsPage() {
  const tickets = await db.contactTicket.findMany({ orderBy: [{ status: "desc" }, { createdAt: "asc" }], take: 200 });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">Support tickets</h1>
      {tickets.length === 0 && <p className="text-muted">No tickets.</p>}
      <ul className="space-y-3" role="list">
        {tickets.map((t) => (
          <li key={t.id} className={`card space-y-1 p-4 ${t.status === "CLOSED" ? "opacity-60" : ""}`}>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="tag text-xs">{t.topic}</span>
              <strong>{t.name}</strong> &lt;<a href={`mailto:${t.email}`} className="link">{t.email}</a>&gt;
              {t.orderNumber && <span className="font-mono text-xs">{t.orderNumber}</span>}
              <span className="font-mono text-xs text-muted">{formatDateTime(t.createdAt)} · {t.status}</span>
            </p>
            <p className="text-sm whitespace-pre-line">{t.message}</p>
            {t.status !== "CLOSED" && <AdminAction action={closeTicketAction.bind(null, t.id)} label="Mark resolved" className="btn-ghost btn-sm" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
