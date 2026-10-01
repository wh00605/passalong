import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const logs = await db.adminAuditLog.findMany({
    where: q ? { OR: [{ action: { contains: q } }, { targetId: q }, { actor: { username: q } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { username: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">Audit log</h1>
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Filter</label>
        <input id="q" name="q" defaultValue={q} placeholder="Action, target ID or staff username" className="input max-w-md" />
        <button type="submit" className="btn-primary">Filter</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Admin actions</caption>
          <thead><tr className="text-left font-mono text-xs uppercase"><th scope="col" className="py-2">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="py-2 font-mono text-xs whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                <td>@{l.actor.username}</td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="font-mono text-xs break-all">{l.targetType} {l.targetId}</td>
                <td className="font-mono text-xs break-all">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
