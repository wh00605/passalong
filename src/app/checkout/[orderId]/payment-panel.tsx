"use client";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { preparePaymentAction } from "@/app/actions/checkout";

function PayForm({ orderId, totalLabel }: { orderId: string; totalLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setBusy(true);
        setError("");
        const { error: err } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: `${window.location.origin}/checkout/${orderId}/complete` },
        });
        // Only reached if confirmation failed immediately (otherwise Stripe redirects).
        setError(err?.message ?? "Payment failed. Please try again.");
        setBusy(false);
      }}
    >
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn-accent w-full text-base" disabled={!stripe || busy}>
        {busy ? "Processing…" : `Pay ${totalLabel}`}
      </button>
    </form>
  );
}

export function PaymentPanel({ orderId, ready, configured, publishableKey, totalLabel }: { orderId: string; ready: boolean; configured: boolean; publishableKey: string; totalLabel: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);

  useEffect(() => {
    if (!configured || !ready) return;
    let cancelled = false;
    preparePaymentAction(orderId).then((res) => {
      if (cancelled) return;
      if (res.ok) setSecret(res.data.clientSecret);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, ready, configured, totalLabel]);

  return (
    <section className="card p-5" aria-labelledby="pay-h">
      <h2 id="pay-h" className="text-lg font-bold">Payment</h2>
      <div className="mt-3">
        {!configured || !publishableKey ? (
          <>
            <p className="rounded-md border-2 border-dashed border-ink/40 p-3 text-sm text-muted">
              Payments aren&apos;t set up on this site yet, so purchases can&apos;t be completed.
            </p>
            <button type="button" className="btn-accent mt-3 w-full" disabled>Pay {totalLabel}</button>
          </>
        ) : !ready ? (
          <p className="text-sm text-muted">Choose how you&apos;d like to receive the item first.</p>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">{error}</p>
        ) : !secret || !stripePromise ? (
          <p className="text-sm text-muted" role="status">Loading secure payment form…</p>
        ) : (
          <Elements
            key={secret}
            stripe={stripePromise}
            options={{
              clientSecret: secret,
              appearance: {
                theme: "flat",
                variables: { colorPrimary: "#121212", colorBackground: "#fbfaf6", colorText: "#121212", borderRadius: "6px", fontFamily: "system-ui, sans-serif" },
                rules: { ".Input": { border: "2px solid #121212" }, ".Tab": { border: "2px solid #121212" } },
              },
            }}
          >
            <PayForm orderId={orderId} totalLabel={totalLabel} />
          </Elements>
        )}
      </div>
    </section>
  );
}
