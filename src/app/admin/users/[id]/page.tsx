import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getBalances } from "@/lib/wallet";
import { formatPence } from "@/lib/money";
import { formatDateTime, timeAgo } from "@/lib/time";
import { AdminAction } from "../../admin-action";
import { moderateUserAction, setRoleAction, messageUserAction } from "../../actions";

export const metadata = { title: "User" };

export default async function AdminUser({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const [me, u] = await Promise.all([
    getCurrentUser(),
    db.user.findUnique({
      where: { id },
      include: {
        _count: { select: { listings: true, ordersBought: true, ordersSold: true, reportsAgainst: true } },
        sanctions: { orderBy: { createdAt: "desc" }, take: 20, include: { moderator: { select: { username: true } } } },
        fraudSignals: { orderBy: { createdAt: "desc" }, take: 10 },
        accounts: { select: { providerId: true } },
      },
    }),
  ]);
  if (!u) notFound();
  const balances = await getBalances(u.id);
  const isAdmin = me?.role === "admin";
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{u.id}</p>
        <h1 className="text-3xl font-extrabold">{u.name} <span className="font-mono text-lg text-muted">@{u.username}</span></h1>
        <p className="text-sm">{u.email} {u.emailVerified ? "(verified)" : "(unverified)"} · {u.role} · joined {timeAgo(u.createdAt)} · sign-in: {u.accounts.map((a) => a.providerId).join(", ")}</p>
        <p className="text-sm">
          Status: {u.deletedAt ? "deleted" : u.banned ? (u.banExpires ? `suspended until ${formatDateTime(u.banExpires)}` : `banned – ${u.banReason}`) : "active"} · {u.warningCount} warnings · ID {u.identityVerifiedAt ? "verified" : "not verified"} · payouts {u.stripePayoutsEnabled ? "enabled" : "off"}
        </p>
        <p className="mt-2"><Link href={`/members/${u.username}`} className="link" target="_blank">Public profile</Link></p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Listings", u._count.listings], ["Purchases", u._count.ordersBought], ["Sales", u._count.ordersSold], ["Reports against", u._count.reportsAgainst], ["Pending", formatPence(balances.pendingPence)], ["Available", formatPence(balances.availablePence)], ["Rating", u.ratingCount ? `${u.ratingAvg.toFixed(1)} (${u.ratingCount})` : "–"]].map(([k, v]) => (
          <div key={k} className="card p-3"><dt className="text-xs text-muted">{k}</dt><dd className="font-display text-xl font-extrabold">{v}</dd></div>
        ))}
      </dl>

      <section className="card space-y-3 p-4" aria-labelledby="act-h">
        <h2 id="act-h" className="font-bold">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <AdminAction action={moderateUserAction.bind(null, u.id, "warn", undefined)} label="Warn" fields={["reason"]} />
          <AdminAction action={moderateUserAction.bind(null, u.id, "suspend", undefined)} label="Suspend" fields={["reason", "days"]} danger />
          {isAdmin && !u.banned && <AdminAction action={moderateUserAction.bind(null, u.id, "ban", undefined)} label="Ban" fields={["reason"]} danger confirmText="Permanently ban this member?" />}
          {isAdmin && u.banned && <AdminAction action={moderateUserAction.bind(null, u.id, "unban", undefined)} label="Lift ban/suspension" fields={["reason"]} />}
          <AdminAction action={messageUserAction.bind(null, u.id)} label="Email member" fields={["title", "body"]} />
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <span className="self-center text-sm">Role:</span>
            {(["user", "moderator", "admin"] as const).filter((r) => r !== u.role).map((r) => (
              <AdminAction key={r} action={setRoleAction.bind(null, u.id, r)} label={`Make ${r}`} confirmText={`Change role to ${r}?`} className="btn-ghost btn-sm" />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-bold">Moderation history</h2>
        {u.sanctions.length === 0 ? <p className="text-sm text-muted">None.</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {u.sanctions.map((s) => <li key={s.id}><span className="font-mono text-xs text-muted">{formatDateTime(s.createdAt)}</span> {s.action} by @{s.moderator.username}: {s.reason}</li>)}
          </ul>
        )}
      </section>
      <section aria-labelledby="fraud-h">
        <h2 id="fraud-h" className="font-bold">Fraud signals</h2>
        {u.fraudSignals.length === 0 ? <p className="text-sm text-muted">None.</p> : (
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {u.fraudSignals.map((f) => <li key={f.id}>{formatDateTime(f.createdAt)} {f.type} score {f.score} {f.resolvedAt ? "(cleared)" : ""}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
