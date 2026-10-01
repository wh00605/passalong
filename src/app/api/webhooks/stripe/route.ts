import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { processStripeEvent } from "@/lib/stripe-webhook";

export const runtime = "nodejs";

/** Stripe webhook. Every event's signature is verified before anything is trusted. */
export async function POST(req: Request) {
  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
  if (!stripe || !signature || secrets.length === 0) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
      break;
    } catch {
      /* try the next secret */
    }
  }
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  try {
    const fresh = await processStripeEvent(event);
    return NextResponse.json({ received: true, duplicate: !fresh });
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
