import { integrations } from "@/lib/env";

export default function PaymentMethodsPage() {
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-medium">Payment methods</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Cards, Apple Pay and Google Pay are handled securely by Stripe. Passalong never sees or stores your full card number.
      </p>
      {!integrations.stripe() && (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong/60 p-4 text-sm text-muted">
          Payments aren&apos;t set up on this site yet. {/* TODO(keys): STRIPE_SECRET_KEY – saved cards UI arrives in Phase 4. */}
        </p>
      )}
    </section>
  );
}
