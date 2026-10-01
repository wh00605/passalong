import { integrations } from "@/lib/env";

export default function PayoutsPage() {
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-extrabold">Payouts & bank details</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        To withdraw money from your wallet, add a UK bank account. Our payment partner Stripe verifies your identity before your first withdrawal – this is a legal requirement.
      </p>
      {!integrations.stripe() && (
        <p className="mt-4 rounded-md border-2 border-dashed border-ink/40 p-4 text-sm text-muted">
          Payouts aren&apos;t set up on this site yet. {/* TODO(keys): STRIPE_SECRET_KEY – Stripe Connect onboarding arrives in Phase 4. */}
        </p>
      )}
    </section>
  );
}
