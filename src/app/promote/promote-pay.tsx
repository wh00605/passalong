"use client";
import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { startPromotionAction } from "@/app/actions/aftersale";

function Confirm({ label }: { label: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setBusy(true);
        const { error: err } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/promote/complete` } });
        setError(err?.message ?? "Payment failed.");
        setBusy(false);
      }}
    >
      <PaymentElement />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn-accent w-full" disabled={busy || !stripe}>{busy ? "Processing…" : "Pay"}</button>
    </form>
  );
}

export function PromotePay({ type, listingId, label, configured, publishableKey }: { type: "BUMP" | "WARDROBE_SPOTLIGHT"; listingId?: string; label: string; configured: boolean; publishableKey: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  if (!configured || !publishableKey) {
    return (
      <>
        <button type="button" className="btn-accent mt-3" disabled>{label}</button>
        <p className="mt-1 text-xs text-muted">Payments aren&apos;t set up on this site yet.</p>
      </>
    );
  }
  if (secret && stripePromise) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret: secret }}>
        <Confirm label={label} />
      </Elements>
    );
  }
  return (
    <>
      <button
        type="button"
        className="btn-accent mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await startPromotionAction(type, listingId);
          setBusy(false);
          if (res.ok) setSecret(res.data.clientSecret);
          else setError(res.error);
        }}
      >
        {busy ? "Preparing…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}
