import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { photoUrl } from "@/lib/storage";
import { ListingThumb } from "@/components/chat/listing-thumb";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requireUser("/orders");
  const sp = await searchParams;
  const tab = sp.tab === "sold" ? "sold" : "bought";
  const orders = await db.order.findMany({
    where: { ...(tab === "sold" ? { sellerId: user.id } : { buyerId: user.id }), status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: { select: { title: true, photoKey: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } },
  });
  const action = (o: (typeof orders)[number]) =>
    tab === "sold" && o.status === "PAID" ? "Send it" : tab === "bought" && o.status === "DELIVERED" ? "Check & confirm" : null;

  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="border-b-2 border-ink pb-3 text-4xl font-extrabold">Orders</h1>
      <nav aria-label="Order type" className="mt-4 flex gap-2">
        {(["bought", "sold"] as const).map((t) => (
          <Link key={t} href={`/orders?tab=${t}`} aria-current={tab === t ? "page" : undefined} className={`btn btn-sm capitalize ${tab === t ? "bg-ink text-surface" : "bg-surface"}`}>
            {t}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="mt-8 text-muted">{tab === "sold" ? "No sales yet." : "No purchases yet."}</p>
      ) : (
        <ul className="mt-6 divide-y-2 divide-line" role="list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center gap-4 py-4 hover:bg-surface">
                <ListingThumb src={o.items[0]?.photoKey ? photoUrl(o.items[0].photoKey, 320) : null} className="h-20 w-16" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {o.items[0]?.title}
                    {o.items.length > 1 && ` + ${o.items.length - 1} more`}
                  </span>
                  <span className="block font-mono text-xs text-muted">
                    {o.number} · {tab === "sold" ? `to ${o.buyer.name}` : `from ${o.seller.name}`} · {timeAgo(o.createdAt)}
                  </span>
                  <span className="mt-1 inline-block rounded-sm border border-ink px-1.5 font-mono text-[11px] uppercase">{ORDER_STATUS_LABEL[o.status]}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono font-semibold">{formatPence(tab === "sold" ? o.sellerEarningsPence : o.totalPence)}</span>
                  {action(o) && <span className="tag mt-1 text-xs">{action(o)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
