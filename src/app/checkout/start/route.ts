import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createCheckoutOrder } from "@/lib/orders";
import { ActionError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

/** Starts checkout for ?listing=, ?offer= or ?items=a,b,c (a bundle from one seller). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, req.url));
  if (!user.emailVerified) return NextResponse.redirect(new URL("/verify-email", req.url));
  if (user.banned) return NextResponse.redirect(new URL("/help/staying-safe", req.url));
  if (!(await checkRateLimit(`checkout-start:${user.id}`, 30, 600))) {
    return NextResponse.redirect(new URL(`/checkout/error?message=${encodeURIComponent("Too many checkout attempts. Please wait a few minutes.")}`, req.url));
  }
  const listingIds = [sp.get("listing"), ...(sp.get("items")?.split(",") ?? [])].filter((x): x is string => !!x && x.length < 40);
  try {
    const order = await createCheckoutOrder({ buyerId: user.id, listingIds, offerId: sp.get("offer") ?? undefined });
    return NextResponse.redirect(new URL(`/checkout/${order.id}`, req.url));
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.redirect(new URL(`/checkout/error?message=${encodeURIComponent(err.message)}`, req.url));
    throw err;
  }
}
