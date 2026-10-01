import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { AdminAction } from "../../admin-action";
import { adminRefundAction, adminCancelOrderAction, adminReleaseFundsAction } from "../../actions";

export const metadata = { title: "Order" };

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      items: true, refunds: true, shipments: { include: { events: true } }, ledgerEntries: { orderBy: { createdAt: "asc" } }, dispute: true,
      buyer: { select: { id: true, username: true } }, seller: { select: { id: true, username: true } },
    },
  });
  if (!o) notFound();
  const fields: [string, React.ReactNode][] = [
    ["Status", ORDER_STATUS_LABEL[o.status]],
    ["Buyer", <Link key="b" href={`/admin/users/${o.buyer.id}`} className="link">@{o.buyer.username}</Link>],
    ["Seller", <Link key="s" href={`/admin/users/${o.seller.id}`} className="link">@{o.seller.username}</Link>],
    ["Items", o.items.map((i) => `${i.title} (${formatPence(i.pricePence)})`).join(", ")],
    ["Subtotal / discount", `${formatPence(o.itemsSubtotalPence)} / −${formatPence(o.bundleDiscountPence)}`],
    ["Postage", formatPence(o.shippingPence)],
    ["Buyer Protection", formatPence(o.buyerProtectionFeePence)],
    ["Total charged", formatPence(o.totalPence)],
    ["Refunded", formatPence(o.refundedPence)],
    ["Seller earnings", formatPence(o.sellerEarningsPence)],
    ["Delivery", o.deliveryType],
    ["Stripe PaymentIntent", o.stripePaymentIntentId ?? "–"],
    ["Paid / shipped / delivered", [o.paidAt, o.shippedAt, o.deliveredAt].map((d) => (d ? formatDateTime(d) : "–")).join(" / ")],
    ["Ship by / auto-release", [o.shipBy, o.autoReleaseAt].map((d) => (d ? formatDateTime(d) : "–")).join(" / ")],
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-mono text-3xl font-medium">{o.number}</h1>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[220px_1fr]">
        {fields.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {o.dispute && <Link href="/admin/disputes" className="link">This order has a dispute ({o.dispute.status})</Link>}
      <section className="card space-y-2 p-4" aria-labelledby="act">
        <h2 id="act" className="font-bold">Support actions</h2>
        <div className="flex flex-wrap gap-2">
          {o.paidAt && !["COMPLETED", "REFUNDED", "CANCELLED"].includes(o.status) && <AdminAction action={adminRefundAction.bind(null, o.id)} label="Refund" fields={["amount", "reason"]} danger />}
          {o.status === "PAID" && <AdminAction action={adminCancelOrderAction.bind(null, o.id)} label="Cancel & refund in full" fields={["reason"]} danger />}
          {["SHIPPED", "DELIVERED", "PAID"].includes(o.status) && <AdminAction action={adminReleaseFundsAction.bind(null, o.id)} label="Release funds to seller" fields={["reason"]} confirmText="Release the seller's earnings now?" />}
        </div>
      </section>
      <section aria-labelledby="ledger">
        <h2 id="ledger" className="font-bold">Ledger</h2>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {o.ledgerEntries.map((e) => <li key={e.id}>{formatDateTime(e.createdAt)} {e.type} {e.bucket} {e.amountPence >= 0 ? "+" : ""}{formatPence(e.amountPence)} – {e.description}</li>)}
        </ul>
      </section>
      <section aria-labelledby="refunds">
        <h2 id="refunds" className="font-bold">Refunds</h2>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {o.refunds.map((r) => <li key={r.id}>{formatDateTime(r.createdAt)} {formatPence(r.amountPence)} {r.status} {r.stripeRefundId} – {r.reason}</li>)}
        </ul>
      </section>
      <section aria-labelledby="ship">
        <h2 id="ship" className="font-bold">Shipments</h2>
        <ul className="mt-2 space-y-2 text-xs">
          {o.shipments.map((s) => (
            <li key={s.id} className="font-mono">{s.direction} {s.carrier} {s.trackingNumber} {s.status} {s.lastError ? `– ${s.lastError}` : ""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
