"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/form";
import { confirmReceivedAction, sellerCancelAction, confirmHandoverAction } from "@/app/actions/orders";
import { manualTrackingAction, retryLabelAction, bookCollectionAction, leaveReviewAction } from "@/app/actions/aftersale";

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        after?.();
        router.refresh();
      }
    });
  return { pending, error, run };
}

export function BuyerActions({ orderId, delivered, windowEnds }: { orderId: string; delivered: boolean; windowEnds: string | null }) {
  const { pending, error, run } = useRun();
  return (
    <div className="card space-y-3 p-5">
      <p className="font-semibold">{delivered ? "Is everything OK with your item?" : "Got your item already?"}</p>
      <p className="text-sm">
        {delivered && windowEnds
          ? `If there's a problem, report it before ${new Date(windowEnds).toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" })}. After that, the payment goes to the seller automatically.`
          : "Confirm once it arrives and you've checked it."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-accent" disabled={pending} onClick={() => confirm("Confirm everything is OK? This releases the payment to the seller.") && run(() => confirmReceivedAction(orderId))}>
          Everything is OK
        </button>
        <Link href={`/orders/${orderId}/dispute`} className="btn-secondary">I have a problem</Link>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function SellerCancel({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, error, run } = useRun();
  if (!open) return <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setOpen(true)}>Can&apos;t send it? Cancel the order</button>;
  return (
    <div className="space-y-2 rounded-md border-2 border-danger p-3">
      <label htmlFor="cancel-reason" className="label">Why are you cancelling?</label>
      <input id="cancel-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      <p className="text-xs text-muted">The buyer is refunded in full. Frequent cancellations can affect your account.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-danger btn-sm" disabled={pending || reason.trim().length < 3} onClick={() => run(() => sellerCancelAction(orderId, reason))}>Cancel order</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Keep order</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function HandoverForm({ orderId }: { orderId: string }) {
  const [code, setCode] = useState("");
  const { pending, error, run } = useRun();
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => confirmHandoverAction(orderId, code)); }}>
      <div>
        <label htmlFor="handover" className="label">Buyer&apos;s code</label>
        <input id="handover" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" className="input w-40 font-mono text-lg tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </div>
      <button type="submit" className="btn-primary" disabled={pending || code.length !== 6}>Confirm handover</button>
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}

export function RetryLabel({ orderId }: { orderId: string }) {
  const { pending, error, run } = useRun();
  return (
    <div>
      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run(() => retryLabelAction(orderId))}>{pending ? "Trying…" : "Try creating the label again"}</button>
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function ManualTrackingForm({ orderId }: { orderId: string }) {
  return (
    <details className="rounded-md border-2 border-ink/30 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Posted it yourself? Add tracking</summary>
      <ActionForm action={manualTrackingAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" submitLabel="Mark as sent" submitClassName="btn-primary btn-sm">
        <input type="hidden" name="orderId" value={orderId} />
        <Field name="carrier" label="Carrier" placeholder="e.g. Royal Mail" required />
        <Field name="trackingNumber" label="Tracking number" required />
      </ActionForm>
    </details>
  );
}

export function CollectionForm({ orderId }: { orderId: string }) {
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState("");
  const { pending, error, run } = useRun();
  const min = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return (
    <details className="rounded-md border-2 border-ink/30 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Prefer a collection from home?</summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="collect-date" className="label">Collection day</label>
          <input id="collect-date" type="date" min={min} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={pending || !date}
          onClick={() => run(async () => {
            const r = await bookCollectionAction(orderId, date);
            if (r.ok) setMsg(`Collection booked (ref ${r.data.confirmation}).`);
            return r;
          })}
        >
          Book collection
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Only some carriers offer collections. If yours doesn&apos;t, use a drop-off point.</p>
      {msg && <p role="status" className="mt-1 text-sm">{msg}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </details>
  );
}

export function ReviewForm({ orderId, otherName }: { orderId: string; otherName: string }) {
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={leaveReviewAction} className="space-y-3" submitLabel="Post review">
      <input type="hidden" name="orderId" value={orderId} />
      <fieldset>
        <legend className="font-semibold">How was it dealing with {otherName}?</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="peer sr-only" onChange={() => setRating(n)} />
              <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
              <Star aria-hidden="true" className={`h-9 w-9 peer-focus-visible:outline-3 peer-focus-visible:outline-ink ${n <= rating ? "fill-accent-400 text-ink" : "text-line-strong"}`} />
            </label>
          ))}
        </div>
      </fieldset>
      <Field name="text" label="Add a comment (optional)">
        {(a11y) => <textarea name="text" rows={3} maxLength={1000} className="input" {...a11y} />}
      </Field>
    </ActionForm>
  );
}
