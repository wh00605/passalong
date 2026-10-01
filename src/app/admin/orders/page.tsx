import Link from "next/link";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import type { OrderStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Orders" };

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const status = typeof sp.status === "string" && sp.status in ORDER_STATUS_LABEL ? (sp.status as OrderStatus) : undefined;
  const orders = await db.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { id: q }, { buyer: { username: q.toLowerCase() } }, { seller: { username: q.toLowerCase() } }, { stripePaymentIntentId: q }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { buyer: { select: { username: true } }, seller: { select: { username: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-medium">Orders</h1>
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search orders</label>
        <input id="q" name="q" defaultValue={q} placeholder="Order number, username or payment ID" className="input max-w-sm" />
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={status ?? ""} className="input w-auto">
          <option value="">Any status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="sr-only">Orders</caption>
          <thead><tr className="text-left font-mono text-xs uppercase"><th scope="col" className="py-2">Order</th><th scope="col">Buyer → Seller</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="py-2"><Link href={`/admin/orders/${o.id}`} className="link font-mono">{o.number}</Link></td>
                <td>@{o.buyer.username} → @{o.seller.username}</td>
                <td className="font-mono">{formatPence(o.totalPence)}</td>
                <td className="text-xs">{ORDER_STATUS_LABEL[o.status]}</td>
                <td className="font-mono text-xs">{timeAgo(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
