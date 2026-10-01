import "server-only";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { getStripe } from "@/lib/stripe";
import { addDays } from "@/lib/time";
import { notify } from "@/lib/notify";
import { listingPath } from "@/lib/slug";

/** Starts paying for a bump (one item) or wardrobe spotlight. Returns a Stripe client secret. */
export async function startPromotion(input: { userId: string; type: "BUMP" | "WARDROBE_SPOTLIGHT"; listingId?: string }) {
  const stripe = getStripe();
  if (!stripe) throw new ActionError("Payments aren't set up on this site yet.");
  const s = await getSettings();
  if (input.type === "BUMP") {
    const l = await db.listing.findFirst({ where: { id: input.listingId ?? "", sellerId: input.userId, status: "ACTIVE", moderationStatus: "OK" } });
    if (!l) throw new ActionError("Only your live items can be bumped.");
    if (l.bumpedUntil && l.bumpedUntil > new Date()) throw new ActionError("This item is already bumped.");
  } else {
    const active = await db.promotion.findFirst({ where: { userId: input.userId, type: "WARDROBE_SPOTLIGHT", status: "ACTIVE", endsAt: { gt: new Date() } } });
    if (active) throw new ActionError("Your wardrobe is already in the spotlight.");
    const count = await db.listing.count({ where: { sellerId: input.userId, status: "ACTIVE" } });
    if (count < 5) throw new ActionError("You need at least 5 live items to use wardrobe spotlight.");
  }
  const price = input.type === "BUMP" ? s.bumpPricePence : s.spotlightPricePence;
  const days = input.type === "BUMP" ? s.bumpDays : s.spotlightDays;
  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true, name: true, stripeCustomerId: true } });
  let customer = user.stripeCustomerId;
  if (!customer) {
    customer = (await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: input.userId } })).id;
    await db.user.update({ where: { id: input.userId }, data: { stripeCustomerId: customer } });
  }
  const promo = await db.promotion.create({ data: { type: input.type, userId: input.userId, listingId: input.listingId, pricePence: price, days } });
  const pi = await stripe.paymentIntents.create(
    {
      amount: price,
      currency: "gbp",
      customer,
      automatic_payment_methods: { enabled: true },
      description: input.type === "BUMP" ? `Passalong bump (${days} days)` : `Passalong wardrobe spotlight (${days} days)`,
      metadata: { kind: "promotion", promotionId: promo.id, userId: input.userId },
    },
    { idempotencyKey: `promo-${promo.id}` },
  );
  await db.promotion.update({ where: { id: promo.id }, data: { stripePaymentIntentId: pi.id } });
  return { clientSecret: pi.client_secret!, promotionId: promo.id, pricePence: price, days };
}

/** Webhook: activate a paid promotion (idempotent). */
export async function activatePromotion(paymentIntentId: string) {
  const promo = await db.promotion.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, include: { listing: true } });
  if (!promo || promo.status !== "PENDING_PAYMENT") return;
  const now = new Date();
  const endsAt = addDays(now, promo.days);
  await db.$transaction([
    db.promotion.update({ where: { id: promo.id }, data: { status: "ACTIVE", startsAt: now, endsAt } }),
    ...(promo.type === "BUMP" && promo.listingId ? [db.listing.update({ where: { id: promo.listingId }, data: { bumpedUntil: endsAt } })] : []),
  ]);
  await notify({
    userId: promo.userId,
    type: "PROMOTION",
    title: promo.type === "BUMP" ? "Your item is bumped!" : "Your wardrobe is in the spotlight!",
    body: `It runs until ${endsAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`,
    url: promo.listing ? listingPath(promo.listing) : "/",
  });
}

/** Cron: mark finished promotions as expired. */
export async function expirePromotions(now = new Date()) {
  const res = await db.promotion.updateMany({ where: { status: "ACTIVE", endsAt: { lt: now } }, data: { status: "EXPIRED" } });
  return { expired: res.count };
}
