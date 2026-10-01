import Stripe from "stripe";

/**
 * In-memory stand-in for the Stripe API used by integration tests. Webhook signature
 * verification uses the real Stripe library (works offline).
 */
export const stripeCalls: { method: string; args: unknown[] }[] = [];
const real = new Stripe("sk_test_dummy_for_webhooks");
let n = 0;
const rec = (method: string) => (...args: unknown[]) => {
  stripeCalls.push({ method, args });
  return Promise.resolve(fakeResult(method, args));
};

function fakeResult(method: string, args: unknown[]) {
  const id = (p: string) => `${p}_test_${++n}`;
  const a = (args[0] ?? {}) as Record<string, unknown>;
  switch (method) {
    case "customers.create": return { id: id("cus") };
    case "paymentIntents.create": return { id: id("pi"), client_secret: `secret_${n}`, amount: a.amount, status: "requires_payment_method" };
    case "paymentIntents.retrieve": return { id: args[0], client_secret: "secret_existing", amount: 0, status: "requires_payment_method" };
    case "paymentIntents.update": return { id: args[0], client_secret: "secret_updated", amount: a.amount };
    case "paymentIntents.cancel": return { id: args[0], status: "canceled" };
    case "refunds.create": return { id: id("re"), status: "succeeded", amount: a.amount };
    case "transfers.create": return { id: id("tr") };
    case "payouts.create": return { id: id("po"), status: "pending" };
    case "accounts.create": return { id: id("acct") };
    case "accountLinks.create": return { url: "https://connect.stripe.test/onboarding" };
    default: return {};
  }
}

export const fakeStripe = {
  webhooks: real.webhooks,
  customers: { create: rec("customers.create") },
  paymentIntents: { create: rec("paymentIntents.create"), retrieve: rec("paymentIntents.retrieve"), update: rec("paymentIntents.update"), cancel: rec("paymentIntents.cancel") },
  refunds: { create: rec("refunds.create") },
  transfers: { create: rec("transfers.create"), list: () => Promise.resolve({ data: [] }), createReversal: rec("transfers.createReversal") },
  payouts: { create: rec("payouts.create") },
  accounts: { create: rec("accounts.create") },
  accountLinks: { create: rec("accountLinks.create") },
};

export function stripeModule() {
  return {
    getStripe: () => fakeStripe,
    requireStripe: () => fakeStripe,
    isTestMode: () => true,
  };
}
