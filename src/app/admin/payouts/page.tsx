import Link from "next/link";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Payouts" };

export default async function AdminPayouts() {
  const payouts = await db.payout.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { id: true, username: true } } } });
  const [pending, available] = await Promise.all([
    db.ledgerEntry.aggregate({ where: { bucket: "PENDING" }, _sum: { amountPence: true } }),
    db.ledgerEntry.aggregate({ where: { bucket: "AVAILABLE" }, _sum: { amountPence: true } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-medium">Payouts</h1>
      <p className="text-sm">
        Sellers&apos; money held on the platform: <strong>{formatPence(pending._sum.amountPence ?? 0)}</strong> pending,{" "}
        <strong>{formatPence(available._sum.amountPence ?? 0)}</strong> available. Your Stripe platform balance should cover at least the sum of both.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Payouts</caption>
          <thead><tr className="text-left font-mono text-xs uppercase"><th scope="col" className="py-2">Date</th><th scope="col">Seller</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Stripe</th></tr></thead>
          <tbody className="divide-y divide-line">
            {payouts.map((p) => (
              <tr key={p.id}>
                <td className="py-2 font-mono text-xs">{formatDateTime(p.createdAt)}</td>
                <td><Link href={`/admin/users/${p.user.id}`} className="link">@{p.user.username}</Link></td>
                <td className="font-mono">{formatPence(p.amountPence)}</td>
                <td className="text-xs">{p.status}{p.failureReason ? ` – ${p.failureReason}` : ""}</td>
                <td className="font-mono text-xs">{p.stripePayoutId ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
