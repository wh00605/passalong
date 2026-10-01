import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Lock, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { integrations } from "@/lib/env";
import { isTestMode } from "@/lib/stripe";
import { ListingPhoto } from "@/components/listing-card";
import { DeliveryPicker } from "./delivery-picker";
import { PaymentPanel } from "./payment-panel";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: PageProps<"/checkout/[orderId]">) {
  const { orderId } = await params;
  const user = await requireUser(`/checkout/${orderId}`);
  const order = await db.order.findFirst({
    where: { id: orderId, buyerId: user.id },
    include: { items: { include: { listing: { include: { photos: { orderBy: { position: "asc" }, take: 1 } } } } }, seller: { select: { name: true, username: true } }, offer: true },
  });
  if (!order) notFound();
  if (order.status !== "PENDING_PAYMENT") redirect(`/orders/${order.id}`);
  const [addresses, settings] = await Promise.all([
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    getSettings(),
  ]);
  const ship = order.shippingAddress as { line1?: string; postcode?: string } | null;
  const selectedAddressId = addresses.find((a) => a.line1 === ship?.line1 && a.postcode === ship?.postcode)?.id ?? null;
  const ready = order.deliveryType === "IN_PERSON" || (order.deliveryType === "HOME" && !!selectedAddressId);

  const rows: [string, number, string?][] = [
    [order.items.length > 1 ? `Items (${order.items.length})` : "Item", order.itemsSubtotalPence],
    ...(order.bundleDiscountPence > 0 ? [[order.offer ? "Agreed offer discount" : "Bundle discount", -order.bundleDiscountPence] as [string, number]] : []),
    ["Postage", order.shippingPence, order.deliveryType === "IN_PERSON" ? "In person – no postage" : undefined],
    [
      "Buyer Protection",
      order.buyerProtectionFeePence,
      `${formatPence(settings.buyerProtectionFixedPence)} + ${settings.buyerProtectionPercentBps / 100}% of the item price`,
    ],
  ];

  return (
    <div className="container-page max-w-5xl py-8">
      <p className="eyebrow">Order {order.number}</p>
      <h1 className="mt-1 text-4xl font-medium">Checkout</h1>
      {integrations.stripe() && isTestMode() && (
        <p className="mt-3 inline-block rounded-lg border border-line bg-accent-300 px-2 py-1 font-mono text-xs">TEST MODE – use card 4242 4242 4242 4242, any future date, any CVC</p>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="items-h">
            <h2 id="items-h" className="text-lg font-bold">From {order.seller.name}</h2>
            <ul className="mt-3 divide-y divide-line" role="list">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <ListingPhoto photo={i.listing.photos[0]} alt="" sizes="64px" className="h-20 w-16 rounded-lg border border-line" />
                  <span className="flex-1 font-semibold">{i.title}</span>
                  <span className="font-mono">{formatPence(i.pricePence)}</span>
                </li>
              ))}
            </ul>
          </section>
          <DeliveryPicker
            orderId={order.id}
            current={order.deliveryType}
            addresses={addresses.map((a) => ({ id: a.id, label: `${a.fullName}, ${a.line1}, ${a.city} ${a.postcode}` }))}
            selectedAddressId={selectedAddressId}
          />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <section className="card p-5" aria-labelledby="sum-h">
            <h2 id="sum-h" className="text-lg font-bold">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {rows.map(([label, amount, note]) => (
                <div key={label}>
                  <div className="flex justify-between">
                    <dt>{label}</dt>
                    <dd className="font-mono">{amount < 0 ? `−${formatPence(-amount)}` : formatPence(amount)}</dd>
                  </div>
                  {note && <p className="text-xs text-muted">{note}</p>}
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="font-mono">{formatPence(order.totalPence)}</dd>
              </div>
            </dl>
          </section>
          <PaymentPanel orderId={order.id} ready={ready} configured={integrations.stripe()} publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""} totalLabel={formatPence(order.totalPence)} />
          <p className="flex gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Buyer Protection: we hold the payment until you confirm the item is as described. <Link href="/legal/buyer-protection" className="underline">Terms</Link>
          </p>
          <p className="flex gap-2 text-xs text-muted">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Payments are processed by Stripe. Passalong never sees or stores your card number.
          </p>
        </aside>
      </div>
    </div>
  );
}
