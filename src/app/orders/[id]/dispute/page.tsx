import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser, isStaff } from "@/lib/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { formatPence } from "@/lib/money";
import { DISPUTE_STATUS_LABEL } from "@/lib/order-status";
import { REASON_LABELS } from "@/lib/disputes";
import { getSettings } from "@/lib/settings";
import { ActionForm, Field } from "@/components/ui/form";
import { openDisputeAction, addEvidenceAction } from "@/app/actions/aftersale";
import { SellerResponse, BuyerResponse } from "./dispute-actions";

export const metadata: Metadata = { title: "Report a problem", robots: { index: false } };

export default async function DisputePage({ params }: PageProps<"/orders/[id]/dispute">) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}/dispute`);
  const order = await db.order.findUnique({
    where: { id },
    include: {
      dispute: { include: { evidence: { orderBy: { createdAt: "asc" }, include: { uploader: { select: { name: true } } } }, events: { orderBy: { createdAt: "asc" } } } },
      shipments: { where: { direction: "RETURN" } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
  });
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id && !isStaff(user))) notFound();
  const isBuyer = order.buyerId === user.id;
  const settings = await getSettings();
  const d = order.dispute;

  if (!d) {
    if (!isBuyer) notFound();
    return (
      <div className="container-page max-w-2xl py-8">
        <p className="eyebrow">Order {order.number}</p>
        <h1 className="mt-1 text-4xl font-extrabold">Report a problem</h1>
        <p className="mt-2 text-muted">
          We&apos;ll hold the payment while you and the seller sort it out. If you can&apos;t agree, our team will decide. Reports must be made within {settings.disputeWindowDays} days of delivery.
        </p>
        <ActionForm action={openDisputeAction} className="mt-6 space-y-5" submitLabel="Report problem">
          <input type="hidden" name="orderId" value={order.id} />
          <fieldset>
            <legend className="label">What&apos;s wrong?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <label key={value} className="relative cursor-pointer">
                  <input type="radio" name="reason" value={value} className="peer sr-only" required />
                  <span className="block rounded-md border-2 border-ink/30 bg-surface p-3 font-semibold peer-checked:border-ink peer-checked:bg-accent-400 peer-focus-visible:outline-3 peer-focus-visible:outline-ink">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field name="description" label="Describe the problem" hint="Be specific – e.g. “The listing said no stains but there's a mark on the sleeve.” You can add photos next." textarea rows={5} maxLength={2000} />
        </ActionForm>
        <p className="mt-6 text-sm"><Link href={`/orders/${order.id}`} className="link">Back to order</Link></p>
      </div>
    );
  }

  const open = !d.status.startsWith("RESOLVED") && d.status !== "CANCELLED";
  const returnLabel = order.shipments.find((s) => s.labelUrl);

  return (
    <div className="container-page max-w-3xl py-8">
      <p className="eyebrow">Order {order.number} · {REASON_LABELS[d.reason]}</p>
      <h1 className="mt-1 text-4xl font-extrabold">{DISPUTE_STATUS_LABEL[d.status]}</h1>
      <p className="mt-2 text-sm text-muted">Payment is on hold while this case is open.</p>

      {open && (
        <div className="mt-6 space-y-4">
          {!isBuyer && order.sellerId === user.id && d.status === "AWAITING_SELLER" && (
            <SellerResponse disputeId={d.id} maxPartial={formatPence(order.itemsSubtotalPence - order.bundleDiscountPence)} deadline={formatDateTime(d.sellerRespondBy)} />
          )}
          {isBuyer && <BuyerResponse disputeId={d.id} status={d.status} partial={d.partialOfferPence ? formatPence(d.partialOfferPence) : null} />}
          {d.status === "RETURN_REQUESTED" && isBuyer && (
            <div className="card p-5">
              <p className="font-semibold">Send the item back</p>
              {returnLabel ? (
                <a href={returnLabel.labelUrl!} target="_blank" rel="noreferrer" className="btn-accent mt-3">Download return label</a>
              ) : (
                <p className="mt-2 text-sm">A prepaid return label couldn&apos;t be created automatically. Post it back with a tracked service, keep your receipt, and add the tracking number as evidence below – our team will refund your postage.</p>
              )}
            </div>
          )}
        </div>
      )}

      <section className="mt-8" aria-labelledby="timeline-h">
        <h2 id="timeline-h" className="border-b-2 border-ink pb-2 text-2xl font-extrabold">Case history</h2>
        <ol className="mt-4 space-y-3 border-l-2 border-ink pl-4">
          {d.events.map((e) => (
            <li key={e.id}>
              <p className="text-sm">{e.body || e.type.toLowerCase()}</p>
              <p className="font-mono text-xs text-muted">{formatDateTime(e.createdAt)} · {e.actorId === order.buyerId ? order.buyer.name : e.actorId === order.sellerId ? order.seller.name : e.actorId ? "Passalong support" : "System"}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="evidence-h">
        <h2 id="evidence-h" className="border-b-2 border-ink pb-2 text-2xl font-extrabold">Evidence</h2>
        {d.evidence.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No evidence added yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-3" role="list">
            {d.evidence.map((ev) => (
              <li key={ev.id} className="card overflow-hidden">
                {ev.storageKey && (
                  <a href={`/api/files/private/${ev.storageKey}-1280.webp`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/private/${ev.storageKey}-640.webp`} alt={`Evidence from ${ev.uploader.name}`} className="aspect-square w-full object-cover" loading="lazy" />
                  </a>
                )}
                <div className="p-2 text-xs">
                  {ev.note && <p>{ev.note}</p>}
                  <p className="font-mono text-muted">{ev.uploader.name} · {formatDateTime(ev.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {open && (isBuyer || order.sellerId === user.id) && (
          <ActionForm action={addEvidenceAction} className="card mt-4 space-y-3 p-5" submitLabel="Add evidence" submitClassName="btn-secondary" encType="multipart/form-data">
            <input type="hidden" name="disputeId" value={d.id} />
            <Field name="photo" label="Photo" type="file" accept="image/*" hint="Clear photos of the problem help us decide quickly." />
            <Field name="note" label="Note" maxLength={1000} />
          </ActionForm>
        )}
      </section>
      <p className="mt-8 text-sm"><Link href={`/orders/${order.id}`} className="link">Back to order</Link></p>
    </div>
  );
}
