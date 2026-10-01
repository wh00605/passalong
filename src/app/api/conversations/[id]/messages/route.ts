import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { messageSelect } from "@/lib/messaging";

/** Returns messages newer than ?after=ISO for a conversation the member is part of. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const conv = await db.conversation.findUnique({ where: { id }, select: { buyerId: true, sellerId: true, buyerLastReadAt: true, sellerLastReadAt: true } });
  if (!conv || (conv.buyerId !== user.id && conv.sellerId !== user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const afterParam = req.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : null;
  const messages = await db.message.findMany({
    where: { conversationId: id, ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: messageSelect,
  });
  const otherReadAt = conv.buyerId === user.id ? conv.sellerLastReadAt : conv.buyerLastReadAt;
  return NextResponse.json({ messages, otherReadAt }, { headers: { "cache-control": "private, no-store" } });
}
