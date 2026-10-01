"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sellerRespondAction, buyerDisputeAction } from "@/app/actions/aftersale";

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  return { pending, error, run };
}

export function SellerResponse({ disputeId, maxPartial, deadline }: { disputeId: string; maxPartial: string; deadline: string }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { pending, error, run } = useRun();
  return (
    <div className="card space-y-4 p-5">
      <p className="font-semibold">How would you like to resolve this? Please respond by {deadline}.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-secondary h-auto flex-col items-start p-3 text-left" disabled={pending} onClick={() => confirm("Accept a return? The buyer gets a return label and a full refund when it arrives.") && run(() => sellerRespondAction(disputeId, "accept_return"))}>
          <span className="font-bold">Accept a return</span>
          <span className="text-xs font-normal">Full refund once the item is back with you.</span>
        </button>
        <button type="button" className="btn-secondary h-auto flex-col items-start p-3 text-left" disabled={pending} onClick={() => confirm("Refund in full without the item coming back?") && run(() => sellerRespondAction(disputeId, "refund_no_return"))}>
          <span className="font-bold">Refund, keep it</span>
          <span className="text-xs font-normal">Full refund now; the buyer keeps the item.</span>
        </button>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => sellerRespondAction(disputeId, "offer_partial", amount)); }}>
        <div>
          <label htmlFor="partial" className="label">Offer a partial refund (less than {maxPartial})</label>
          <input id="partial" inputMode="decimal" className="input w-40 font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="£" />
        </div>
        <button type="submit" className="btn-secondary" disabled={pending || !amount}>Offer</button>
      </form>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => sellerRespondAction(disputeId, "escalate", undefined, note)); }}>
        <label htmlFor="esc-note" className="label">Disagree? Ask our team to decide</label>
        <textarea id="esc-note" className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain your side – add photos as evidence below." />
        <button type="submit" className="btn-ghost btn-sm" disabled={pending}>Ask support to review</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function BuyerResponse({ disputeId, status, partial }: { disputeId: string; status: string; partial: string | null }) {
  const { pending, error, run } = useRun();
  return (
    <div className="card space-y-3 p-5">
      {status === "AWAITING_BUYER" && partial ? (
        <>
          <p className="font-semibold">The seller offered a partial refund of {partial}.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-accent" disabled={pending} onClick={() => run(() => buyerDisputeAction(disputeId, "accept_partial"))}>Accept {partial}</button>
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => buyerDisputeAction(disputeId, "decline_partial"))}>Decline – ask support</button>
          </div>
        </>
      ) : status === "AWAITING_SELLER" ? (
        <p className="text-sm">We&apos;ve asked the seller to respond. If they don&apos;t in time, our team will step in automatically.</p>
      ) : status === "ESCALATED" ? (
        <p className="text-sm">Our team is reviewing the evidence and will decide within 3 working days.</p>
      ) : null}
      {["AWAITING_SELLER", "AWAITING_BUYER", "ESCALATED"].includes(status) && (
        <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => confirm("Close the case? The payment will be released to the seller.") && run(() => buyerDisputeAction(disputeId, "close"))}>
          Problem solved – close the case
        </button>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
