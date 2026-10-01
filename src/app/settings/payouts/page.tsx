import { requireUser } from "@/lib/session";
import { integrations } from "@/lib/env";
import { formatDate } from "@/lib/time";
import { payoutOnboardingAction } from "@/app/actions/aftersale";

export default async function PayoutsPage({ searchParams }: PageProps<"/settings/payouts">) {
  const user = await requireUser("/settings/payouts");
  const sp = await searchParams;
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-medium">Payouts & bank details</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        To withdraw money from your wallet, connect a UK bank account. Our payment partner Stripe verifies your identity before your first withdrawal – a legal requirement for anyone receiving payments.
      </p>
      {!integrations.stripe() ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong/60 p-4 text-sm text-muted">Payouts aren&apos;t set up on this site yet.</p>
      ) : (
        <div className="card mt-6 max-w-xl space-y-3 p-5">
          {user.stripePayoutsEnabled ? (
            <>
              <p className="font-semibold">✓ Payouts are set up</p>
              {user.identityVerifiedAt && <p className="text-sm">Identity verified on {formatDate(user.identityVerifiedAt)}.</p>}
              <form action={payoutOnboardingAction}><button type="submit" className="btn-secondary btn-sm">Update bank or personal details</button></form>
            </>
          ) : (
            <>
              <p className="font-semibold">{user.stripeDetailsSubmitted ? "Stripe is checking your details" : "Not set up yet"}</p>
              {sp.return && !user.stripeDetailsSubmitted && <p className="text-sm">Not finished? Pick up where you left off.</p>}
              <p className="text-sm">You&apos;ll be taken to Stripe to enter your name, date of birth, address and bank details. It takes about 5 minutes.</p>
              <form action={payoutOnboardingAction}><button type="submit" className="btn-primary">{user.stripeAccountId ? "Continue setup" : "Set up payouts"}</button></form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
