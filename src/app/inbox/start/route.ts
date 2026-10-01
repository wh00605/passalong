import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { startConversation } from "@/lib/messaging";
import { ActionError } from "@/lib/errors";

/** Opens (or creates) the chat about a listing, then redirects to it. */
export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get("listing") ?? "";
  const offer = req.nextUrl.searchParams.get("offer") === "1";
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/inbox/start?listing=${listingId}${offer ? "&offer=1" : ""}`)}`, req.url));
  if (!user.emailVerified) return NextResponse.redirect(new URL("/verify-email", req.url));
  try {
    const conv = await startConversation(user.id, listingId);
    return NextResponse.redirect(new URL(`/inbox/${conv.id}${offer ? "?offer=1" : ""}`, req.url));
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.redirect(new URL(`/inbox?error=${encodeURIComponent(err.message)}`, req.url));
    throw err;
  }
}
