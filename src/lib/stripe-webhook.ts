import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { handlePaymentFailed, handlePaymentSucceeded } from "@/lib/orders";
import { activatePromotion } from "@/lib/promotions";
import { handlePayoutEvent, syncConnectedAccount } from "@/lib/payouts";
import { raiseSignal } from "@/lib/fraud";

/** Processes a verified Stripe event exactly once. Returns false if it was a duplicate. */
export async function processStripeEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return false; // already processed (unique id)
  }
  try {
    await dispatch(event);
  } catch (err) {
    // Allow Stripe to retry by forgetting we saw it.
    await db.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    throw err;
  }
  return true;
}

async function dispatch(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : (pi.latest_charge?.id ?? null);
      if (pi.metadata?.kind === "order") await handlePaymentSucceeded(pi.id, chargeId);
      else if (pi.metadata?.kind === "promotion") await activatePromotion(pi.id);
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === "order") await handlePaymentFailed(pi.id, pi.last_payment_error?.code ?? "failed");
      break;
    }
    case "refund.updated":
    case "refund.created": {
      const r = event.data.object as Stripe.Refund;
      const status = r.status === "succeeded" ? "SUCCEEDED" : r.status === "failed" || r.status === "canceled" ? "FAILED" : "PENDING";
      await db.refund.updateMany({ where: { stripeRefundId: r.id }, data: { status } });
      break;
    }
    case "charge.dispute.created": {
      // A card chargeback (not our in-app dispute). Flag the buyer for review.
      const d = event.data.object as Stripe.Dispute;
      const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
      const order = pi ? await db.order.findUnique({ where: { stripePaymentIntentId: pi }, select: { buyerId: true, number: true } }) : null;
      if (order) await raiseSignal(order.buyerId, "PAYMENT_FAILURES", 40, { chargeback: d.id, order: order.number, reason: d.reason });
      break;
    }
    case "account.updated":
      await syncConnectedAccount(event.data.object as Stripe.Account);
      break;
    case "payout.paid":
    case "payout.failed":
      await handlePayoutEvent(event);
      break;
    default:
      break;
  }
}
