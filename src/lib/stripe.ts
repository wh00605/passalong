import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Returns the Stripe client, or null when STRIPE_SECRET_KEY isn't set (payments show as "not set up"). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (process.env.NODE_ENV === "production" && key.startsWith("sk_live_") && process.env.STRIPE_LIVE_MODE_APPROVED !== "true") {
    // Safety latch: stay in test mode until the owner explicitly approves going live.
    throw new Error("Live Stripe key detected but STRIPE_LIVE_MODE_APPROVED is not 'true'.");
  }
  client ??= new Stripe(key, { appInfo: { name: "Passalong" }, maxNetworkRetries: 2 });
  return client;
}

export function requireStripe(): Stripe {
  const s = getStripe();
  if (!s) throw new Error("Payments are not configured (STRIPE_SECRET_KEY missing).");
  return s;
}

export function isTestMode() {
  return !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
}
