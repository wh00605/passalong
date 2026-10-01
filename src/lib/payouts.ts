import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { getStripe, requireStripe } from "@/lib/stripe";
import { getBalances } from "@/lib/wallet";
import { getSettings } from "@/lib/settings";
import { formatPence } from "@/lib/money";
import { siteUrl } from "@/lib/env";
import { notify } from "@/lib/notify";

/** Creates the seller's Stripe connected account (if needed) and returns a hosted onboarding link. */
export async function connectOnboardingLink(userId: string) {
  const stripe = getStripe();
  if (!stripe) throw new ActionError("Payouts aren't set up on this site yet.");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, stripeAccountId: true, username: true } });
  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create(
      {
        country: "GB",
        email: user.email,
        controller: {
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
          requirement_collection: "stripe",
        },
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        business_profile: {
          mcc: "5931", // used merchandise and second-hand stores
          product_description: "Selling pre-owned personal items on Passalong",
          url: `${siteUrl}/members/${user.username}`,
        },
        settings: { payouts: { schedule: { interval: "manual" } } },
        metadata: { userId },
      },
      { idempotencyKey: `connect-account-${userId}` },
    );
    accountId = account.id;
    await db.user.update({ where: { id: userId }, data: { stripeAccountId: accountId } });
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl}/settings/payouts?refresh=1`,
    return_url: `${siteUrl}/settings/payouts?return=1`,
  });
  return link.url;
}

/** Webhook: keep our copy of the seller's verification status in sync. */
export async function syncConnectedAccount(account: Stripe.Account) {
  const user = await db.user.findUnique({ where: { stripeAccountId: account.id }, select: { id: true, identityVerifiedAt: true, stripePayoutsEnabled: true } });
  if (!user) return;
  const verified = account.payouts_enabled && account.details_submitted && (account.requirements?.currently_due?.length ?? 0) === 0;
  await db.user.update({
    where: { id: user.id },
    data: {
      stripePayoutsEnabled: !!account.payouts_enabled,
      stripeDetailsSubmitted: !!account.details_submitted,
      identityVerifiedAt: verified ? (user.identityVerifiedAt ?? new Date()) : user.identityVerifiedAt,
    },
  });
  if (account.payouts_enabled && !user.stripePayoutsEnabled) {
    await notify({ userId: user.id, type: "ACCOUNT", title: "You're ready to withdraw", body: "Your identity has been verified and your bank account is connected.", url: "/wallet" });
  }
}

export async function withdraw(userId: string, amountPence: number) {
  const settings = await getSettings();
  const stripe = requireStripe();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { stripeAccountId: true, stripePayoutsEnabled: true } });
  if (!user.stripeAccountId || !user.stripePayoutsEnabled) throw new ActionError("Set up payouts first – we need to verify your identity and bank account.");
  if (!Number.isInteger(amountPence) || amountPence < settings.minWithdrawalPence) throw new ActionError(`The minimum withdrawal is ${formatPence(settings.minWithdrawalPence)}.`);

  // Reserve the money in the ledger first (serialisable to prevent double withdrawals).
  const payout = await db.$transaction(
    async (tx) => {
      const { availablePence } = await getBalances(userId, tx);
      if (amountPence > availablePence) throw new ActionError(`You can withdraw up to ${formatPence(availablePence)}.`);
      const p = await tx.payout.create({ data: { userId, amountPence } });
      await tx.ledgerEntry.create({ data: { userId, payoutId: p.id, type: "PAYOUT", bucket: "AVAILABLE", amountPence: -amountPence, description: "Withdrawal to bank" } });
      return p;
    },
    { isolationLevel: "Serializable" },
  );

  try {
    await stripe.transfers.create({ amount: amountPence, currency: "gbp", destination: user.stripeAccountId, metadata: { payoutId: payout.id, userId } }, { idempotencyKey: `transfer-${payout.id}` });
    const sp = await stripe.payouts.create({ amount: amountPence, currency: "gbp", metadata: { payoutId: payout.id } }, { stripeAccount: user.stripeAccountId, idempotencyKey: `payout-${payout.id}` });
    return db.payout.update({ where: { id: payout.id }, data: { stripePayoutId: sp.id, status: "IN_TRANSIT" } });
  } catch (err) {
    await reversePayout(payout.id, err instanceof Error ? err.message : "Stripe error");
    throw new ActionError("We couldn't start your withdrawal. No money has left your wallet – please try again later.");
  }
}

async function reversePayout(payoutId: string, reason: string) {
  const p = await db.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (p.status === "FAILED") return;
  await db.$transaction([
    db.payout.update({ where: { id: payoutId }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } }),
    db.ledgerEntry.create({ data: { userId: p.userId, payoutId, type: "PAYOUT_REVERSAL", bucket: "AVAILABLE", amountPence: p.amountPence, description: "Withdrawal failed – money returned to your wallet" } }),
  ]);
}

/** Connect webhooks for payouts on sellers' accounts. */
export async function handlePayoutEvent(event: Stripe.Event) {
  const sp = event.data.object as Stripe.Payout;
  const payout = await db.payout.findUnique({ where: { stripePayoutId: sp.id } });
  if (!payout) return;
  if (event.type === "payout.paid") {
    await db.payout.update({ where: { id: payout.id }, data: { status: "PAID", arrivedAt: new Date((sp.arrival_date ?? Date.now() / 1000) * 1000) } });
    await notify({ userId: payout.userId, type: "ORDER_UPDATE", title: `${formatPence(payout.amountPence)} is on its way`, body: "Your withdrawal has been paid to your bank account.", url: "/wallet" });
  } else if (event.type === "payout.failed") {
    await reversePayout(payout.id, sp.failure_message ?? "Payout failed");
    // The money is still in the seller's Stripe balance; pull it back so the ledger stays correct.
    const stripe = getStripe();
    const transfers = await stripe?.transfers.list({ destination: event.account ?? undefined, limit: 20 });
    const t = transfers?.data.find((x) => x.metadata?.payoutId === payout.id);
    if (t && stripe) await stripe.transfers.createReversal(t.id, { amount: payout.amountPence }).catch((e) => console.error("[payout] reversal", e));
    await notify({ userId: payout.userId, type: "ORDER_UPDATE", title: "Withdrawal failed", body: `${sp.failure_message ?? "Your bank rejected the payment"}. The money is back in your wallet – check your bank details.`, url: "/settings/payouts" });
  }
}
