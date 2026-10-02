import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { requireUser, isStaff } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { handoverCode } from "@/lib/handover";
import { getSettings } from "@/lib/settings";
import { photoUrl } from "@/lib/storage";
import { ListingThumb } from "@/components/chat/listing-thumb";
import { Stars } from "@/components/stars";
import { BuyerActions, SellerCancel, HandoverForm, ManualTrackingForm, RetryLabel, CollectionForm, ReviewForm } from "./order-actions";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

const STEPS = ["PAID", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}`);
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      buyer: { select: { id: true, name: true, username: true } },
      seller: { select: { id: true, name: true, username: true } },
      shipments: { include: { events: { orderBy: { occurredAt: "desc" } } }, orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" } },
      reviews: true,
      dispute: true,
    },
  });
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id && !isStaff(user))) notFound();
  const settings = await getSettings();
  const isBuyer = order.buyerId === user.id;
  const isSeller = order.sellerId === user.id;
  const outbound = order.shipments.find((s) => s.direction === "OUTBOUND");
  const conv = await db.conversation.findFirst({ where: { buyerId: order.buyerId, listingId: order.items[0]?.listingId }, select: { id: true } });
  const myReview = order.reviews.find((r) => r.authorId === user.id);
  const theirReview = order.reviews.find((r) => r.authorId !== user.id);
  const stepIndex = order.status === "DISPUTED" ? 2 : STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const address = order.shippingAddress as { fullName: string; line1: string; line2?: string; city: string; postcode: string } | null;
  const windowEnds = order.deliveredAt ? new Date(order.deliveredAt.getTime() + settings.disputeWindowDays * 86_400_000) : null;

  return (
    <div className="container-page max-w-4xl py-8">
      <p className="eyebrow">{isSeller ? "Sale" : "Purchase"} · {order.number}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <h1 className="text-4xl font-medium">{ORDER_STATUS_LABEL[order.status]}</h1>
        {conv && <Link href={`/inbox/${conv.id}`} className="btn-secondary btn-sm">Message {isBuyer ? "seller" : "buyer"}</Link>}
      </div>

      {stepIndex >= 0 && !["CANCELLED", "REFUNDED"].includes(order.status) && (
        <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} className="text-center" aria-current={i === stepIndex ? "step" : undefined}>
              <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-line font-mono text-xs ${i <= stepIndex ? "bg-accent-400" : "bg-surface"}`}>
                {i < stepIndex ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              <span className="mt-1 block text-xs font-semibold">{ORDER_STATUS_LABEL[s]}</span>
              {i < stepIndex && <span className="sr-only"> (done)</span>}
            </li>
          ))}
        </ol>
      )}

      {/* What to do next */}
      <section className="mt-6 space-y-4" aria-labelledby="next-h">
        <h2 id="next-h" className="sr-only">Next steps</h2>
        {isSeller && order.status === "PAID" && order.deliveryType === "HOME" && (
          <div className="card space-y-3 p-5">
            <p className="font-semibold">Post it by {order.shipBy ? formatDate(order.shipBy) : "soon"}.</p>
            {outbound?.labelUrl ? (
              <>
                <p className="text-sm">Print the prepaid label (or show it at the drop-off point), pack the item securely and drop it off.</p>
                <div className="flex flex-wrap gap-2">
                  <a href={outbound.labelUrl} target="_blank" rel="noreferrer" className="btn-accent">Download label</a>
                  <span className="self-center font-mono text-xs text-muted">{outbound.carrier} · {outbound.trackingNumber}</span>
                </div>
                <CollectionForm orderId={order.id} />
              </>
            ) : (
              <>
                {outbound?.lastError && <p className="rounded-lg border border-line bg-accent-300 p-3 text-sm">{outbound.lastError}</p>}
                <RetryLabel orderId={order.id} />
                <ManualTrackingForm orderId={order.id} />
              </>
            )}
            <SellerCancel orderId={order.id} />
          </div>
        )}
        {isSeller && order.status === "PAID" && order.deliveryType === "IN_PERSON" && (
          <div className="card space-y-3 p-5">
            <p className="font-semibold">Meet the buyer to hand it over.</p>
            <p className="text-sm">When you hand it over, ask the buyer for their 6-digit code and enter it here. Never hand over the item without the code.</p>
            <HandoverForm orderId={order.id} />
            <SellerCancel orderId={order.id} />
          </div>
        )}
        {isBuyer && order.status === "PAID" && order.deliveryType === "IN_PERSON" && (
          <div className="card p-5">
            <p className="font-semibold">Your handover code</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">{handoverCode(order.id)}</p>
            <p className="mt-2 text-sm">Only give this code to the seller after you&apos;ve checked the item. Giving the code confirms you received it.</p>
          </div>
        )}
        {isBuyer && ["SHIPPED", "DELIVERED"].includes(order.status) && (
          <BuyerActions orderId={order.id} delivered={order.status === "DELIVERED"} windowEnds={windowEnds?.toISOString() ?? null} />
        )}
        {order.dispute && (
          <Link href={`/orders/${order.id}/dispute`} className="block rounded-lg border border-hot bg-surface p-4 font-semibold hover:bg-brand-50">
            A problem was reported on this order → view the case
          </Link>
        )}
        {order.status === "COMPLETED" && (isBuyer || isSeller) && (
          <div id="review" className="card p-5">
            {myReview ? (
              <p>You left {myReview.rating} stars{myReview.isAutomatic ? " (automatic feedback)" : ""}. Thanks!</p>
            ) : (
              <ReviewForm orderId={order.id} otherName={isBuyer ? order.seller.name : order.buyer.name} />
            )}
            {theirReview && (
              <div className="mt-4 border-t border-line pt-3 text-sm">
                <p className="font-semibold">Their review of you</p>
                <Stars rating={theirReview.rating} size={14} />
                {theirReview.text && <p className="mt-1">{theirReview.text}</p>}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Tracking */}
      {order.shipments.filter((s) => s.trackingNumber).map((s) => (
        <section key={s.id} className="card mt-6 p-5" aria-labelledby={`track-${s.id}`}>
          <h2 id={`track-${s.id}`} className="text-lg font-bold">{s.direction === "RETURN" ? "Return tracking" : "Tracking"}</h2>
          <p className="font-mono text-sm">
            {s.carrier} · {s.trackingUrl ? <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="link">{s.trackingNumber}</a> : s.trackingNumber}
          </p>
          {s.events.length ? (
            <ol className="mt-3 space-y-2 border-l-2 border-ink pl-4 text-sm">
              {s.events.map((e) => (
                <li key={e.id}>
                  <span className="font-semibold">{e.description}</span>
                  <span className="block font-mono text-xs text-muted">{formatDateTime(e.occurredAt)}{e.location ? ` · ${e.location}` : ""}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">No tracking updates yet.</p>
          )}
        </section>
      ))}

      {/* Items & money */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-5" aria-labelledby="items-h">
          <h2 id="items-h" className="text-lg font-bold">Items</h2>
          <ul className="mt-3 space-y-3" role="list">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <ListingThumb src={i.photoKey ? photoUrl(i.photoKey, 320) : null} className="h-14 w-12" />
                <span className="flex-1 text-sm font-semibold">{i.title}</span>
                <span className="font-mono text-sm">{formatPence(i.pricePence)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            {isBuyer ? "Seller" : "Buyer"}: <Link href={`/members/${isBuyer ? order.seller.username : order.buyer.username}`} className="link">{isBuyer ? order.seller.name : order.buyer.name}</Link>
          </p>
          {address && (isBuyer || isSeller) && order.deliveryType === "HOME" && (
            <address className="mt-3 text-sm not-italic">
              <span className="eyebrow block">Delivery address</span>
              {address.fullName}, {address.line1}{address.line2 ? `, ${address.line2}` : ""}, {address.city} {address.postcode}
            </address>
          )}
          {order.deliveryType === "IN_PERSON" && <p className="mt-3 text-sm">Delivery: in person</p>}
        </section>
        <section className="card p-5" aria-labelledby="money-h">
          <h2 id="money-h" className="text-lg font-bold">{isSeller ? "Your earnings" : "Payment"}</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {isSeller ? (
              <>
                <div className="flex justify-between"><dt>Item price{order.bundleDiscountPence ? " (after discount)" : ""}</dt><dd className="font-mono">{formatPence(order.itemsSubtotalPence - order.bundleDiscountPence)}</dd></div>
                <div className="flex justify-between"><dt>Selling fee</dt><dd className="font-mono">{formatPence(order.itemsSubtotalPence - order.bundleDiscountPence - order.sellerEarningsPence)}</dd></div>
                <div className="flex justify-between border-t border-line pt-1.5 font-bold"><dt>You receive</dt><dd className="font-mono">{formatPence(order.sellerEarningsPence)}</dd></div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><dt>Items</dt><dd className="font-mono">{formatPence(order.itemsSubtotalPence)}</dd></div>
                {order.bundleDiscountPence > 0 && <div className="flex justify-between"><dt>Discount</dt><dd className="font-mono">−{formatPence(order.bundleDiscountPence)}</dd></div>}
                <div className="flex justify-between"><dt>Postage</dt><dd className="font-mono">{formatPence(order.shippingPence)}</dd></div>
                <div className="flex justify-between"><dt>Buyer Protection</dt><dd className="font-mono">{formatPence(order.buyerProtectionFeePence)}</dd></div>
                <div className="flex justify-between border-t border-line pt-1.5 font-bold"><dt>Total paid</dt><dd className="font-mono">{formatPence(order.totalPence)}</dd></div>
              </>
            )}
            {order.refunds.map((r) => (
              <div key={r.id} className="flex justify-between text-muted"><dt>Refund ({r.status.toLowerCase()})</dt><dd className="font-mono">−{formatPence(r.amountPence)}</dd></div>
            ))}
          </dl>
          {order.paidAt && <p className="mt-3 font-mono text-xs text-muted">Paid {formatDateTime(order.paidAt)}</p>}
          {order.cancelReason && <p className="mt-2 text-sm">Cancelled: {order.cancelReason}</p>}
        </section>
      </div>
    </div>
  );
}
