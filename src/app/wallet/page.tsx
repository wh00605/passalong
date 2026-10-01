import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getBalances } from "@/lib/wallet";
import { getSettings } from "@/lib/settings";
import { formatPence } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { integrations } from "@/lib/env";
import { WithdrawForm } from "./withdraw-form";

export const metadata: Metadata = { title: "Wallet", robots: { index: false } };

export default async function WalletPage() {
  const user = await requireUser("/wallet");
  const year = new Date().getFullYear();
  const [balances, entries, payouts, settings, yearSales] = await Promise.all([
    getBalances(user.id),
    db.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    getSettings(),
    db.order.aggregate({
      where: { sellerId: user.id, status: "COMPLETED", completedAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
      _sum: { sellerEarningsPence: true, refundedPence: true },
      _count: { _all: true },
    }),
  ]);
  const income = (yearSales._sum.sellerEarningsPence ?? 0) - (yearSales._sum.refundedPence ?? 0);
  const reportable = yearSales._count._all >= settings.taxReportSalesThreshold || income >= settings.taxReportIncomePence;

  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="border-b border-line pb-3 text-4xl font-medium">Wallet</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="eyebrow">Available</p>
          <p className="mt-1 font-display text-4xl font-medium">{formatPence(balances.availablePence)}</p>
          <p className="mt-1 text-sm text-muted">Ready to withdraw to your bank.</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Pending</p>
          <p className="mt-1 font-display text-4xl font-medium">{formatPence(balances.pendingPence)}</p>
          <p className="mt-1 text-sm text-muted">From sales not yet completed. Released when the buyer confirms, or {settings.autoReleaseDays} days after delivery.</p>
        </div>
      </div>

      <section className="card mt-6 p-5" aria-labelledby="withdraw-h">
        <h2 id="withdraw-h" className="text-lg font-bold">Withdraw</h2>
        {!integrations.stripe() ? (
          <p className="mt-2 text-sm text-muted">Withdrawals aren&apos;t set up on this site yet.</p>
        ) : !user.stripePayoutsEnabled ? (
          <p className="mt-2 text-sm">
            Before your first withdrawal we need to verify your identity and bank details (a legal requirement for payments).{" "}
            <Link href="/settings/payouts" className="link">Set up payouts</Link>
          </p>
        ) : (
          <WithdrawForm max={(balances.availablePence / 100).toFixed(2)} minLabel={formatPence(settings.minWithdrawalPence)} />
        )}
      </section>

      {payouts.length > 0 && (
        <section className="mt-8" aria-labelledby="payouts-h">
          <h2 id="payouts-h" className="border-b border-line pb-2 text-2xl font-medium">Withdrawals</h2>
          <ul className="divide-y divide-line" role="list">
            {payouts.map((p) => (
              <li key={p.id} className="flex justify-between py-3 text-sm">
                <span>{formatDateTime(p.createdAt)} · {p.status.toLowerCase().replace("_", " ")}{p.failureReason ? ` – ${p.failureReason}` : ""}</span>
                <span className="font-mono">{formatPence(p.amountPence)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="history-h">
        <h2 id="history-h" className="border-b border-line pb-2 text-2xl font-medium">History</h2>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No activity yet.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Wallet history</caption>
            <thead>
              <tr className="text-left font-mono text-xs tracking-wider text-muted uppercase">
                <th scope="col" className="py-2">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Balance</th>
                <th scope="col" className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 font-mono text-xs whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td>{e.orderId ? <Link href={`/orders/${e.orderId}`} className="hover:underline">{e.description}</Link> : e.description}</td>
                  <td className="text-xs text-muted">{e.bucket.toLowerCase()}</td>
                  <td className={`text-right font-mono ${e.amountPence < 0 ? "" : "font-semibold"}`}>{e.amountPence < 0 ? "−" : "+"}{formatPence(Math.abs(e.amountPence))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card mt-8 p-5" aria-labelledby="tax-h">
        <h2 id="tax-h" className="text-lg font-bold">Income records {year}</h2>
        <p className="mt-1 text-sm">
          {yearSales._count._all} completed sale{yearSales._count._all === 1 ? "" : "s"}, {formatPence(income)} received.
        </p>
        <p className="mt-2 text-sm text-muted">
          UK law requires platforms to report sellers with {settings.taxReportSalesThreshold}+ sales or {formatPence(settings.taxReportIncomePence)}+ income in a calendar year to HMRC.
          {reportable ? " You've reached this threshold – please add your tax details." : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/wallet/income.csv?year=${year}`} className="btn-secondary btn-sm">Download {year} (CSV)</Link>
          <Link href="/settings/tax" className="btn-ghost btn-sm">Tax details</Link>
        </div>
      </section>
    </div>
  );
}
