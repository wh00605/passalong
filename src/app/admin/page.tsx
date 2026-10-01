import Link from "next/link";
import { getAnalytics } from "@/lib/analytics";
import { formatPence } from "@/lib/money";
import { MiniBars } from "./mini-bars";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const a = await getAnalytics(days);
  const tiles: [string, string][] = [
    ["Sign-ups", a.period.signups.toLocaleString("en-GB")],
    ["New listings", a.period.listings.toLocaleString("en-GB")],
    ["Orders", a.period.orders.toLocaleString("en-GB")],
    ["GMV", formatPence(a.period.gmvPence)],
    ["Fee revenue", formatPence(a.period.feePence)],
  ];
  const queues: [string, number, string][] = [
    ["Open reports", a.queues.openReports, "/admin/moderation"],
    ["Listings to review", a.queues.pendingListings, "/admin/moderation?tab=listings"],
    ["Fraud signals", a.queues.openSignals, "/admin/moderation?tab=fraud"],
    ["Open disputes", a.queues.openDisputes, "/admin/disputes"],
    ["Illegal content notices", a.queues.openNotices, "/admin/notices"],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-medium">Dashboard</h1>
        <nav aria-label="Time range" className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/admin?days=${d}`} aria-current={d === days ? "true" : undefined} className={`btn btn-sm ${d === days ? "bg-brand-600 text-white" : "bg-surface"}`}>{d} days</Link>
          ))}
        </nav>
      </div>

      <section aria-labelledby="queues-h">
        <h2 id="queues-h" className="eyebrow mb-2">Needs attention</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-5" role="list">
          {queues.map(([label, n, href]) => (
            <li key={label}>
              <Link href={href} className={`block rounded-none border border-line p-3 hover:shadow-[var(--shadow-tag-sm)] ${n > 0 ? "bg-accent-400" : "bg-surface"}`}>
                <span className="block font-display text-3xl font-medium">{n}</span>
                <span className="text-xs font-semibold">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kpi-h">
        <h2 id="kpi-h" className="eyebrow mb-2">Last {days} days</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {tiles.map(([k, v]) => (
            <div key={k} className="card p-3">
              <dt className="text-xs font-semibold text-muted">{k}</dt>
              <dd className="font-display text-2xl font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">
          Totals: {a.totals.members.toLocaleString("en-GB")} members · {a.totals.liveListings.toLocaleString("en-GB")} live listings · {a.totals.totalOrders.toLocaleString("en-GB")} paid orders all-time. GMV = item value of paid orders (excl. postage and fees). Fee revenue = Buyer Protection + seller commission + promotions.
        </p>
      </section>

      <section aria-labelledby="charts-h" className="grid gap-4 md:grid-cols-2">
        <h2 id="charts-h" className="sr-only">Daily charts</h2>
        <MiniBars title="Sign-ups" data={a.series.signups} />
        <MiniBars title="New listings" data={a.series.listings} />
        <MiniBars title="Orders" data={a.series.orders} />
        <MiniBars title="GMV" data={a.series.gmv} kind="money" />
        <MiniBars title="Order fee revenue" data={a.series.fees} kind="money" />
        <MiniBars title="Promotion revenue" data={a.series.promoRevenue} kind="money" />
      </section>
    </div>
  );
}
