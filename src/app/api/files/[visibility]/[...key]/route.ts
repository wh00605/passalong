import { NextResponse } from "next/server";
import { getObject, signedUrl } from "@/lib/storage";
import { getCurrentUser, isStaff } from "@/lib/session";
import { db } from "@/lib/db";
import { integrations } from "@/lib/env";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", json: "application/json", zip: "application/zip" };

/** Who may read a private object, derived from its key prefix. */
async function canReadPrivate(key: string, user: { id: string; role: string }): Promise<boolean> {
  if (isStaff(user)) return true;
  const [scope, id] = key.split("/");
  if (scope === "chat") {
    const conv = await db.conversation.findUnique({ where: { id }, select: { buyerId: true, sellerId: true } });
    return !!conv && (conv.buyerId === user.id || conv.sellerId === user.id);
  }
  if (scope === "disputes") {
    const dispute = await db.dispute.findUnique({ where: { id }, select: { order: { select: { buyerId: true, sellerId: true } } } });
    return !!dispute && (dispute.order.buyerId === user.id || dispute.order.sellerId === user.id);
  }
  if (scope === "exports") return id === user.id;
  return false;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[visibility]/[...key]">) {
  const { visibility, key: parts } = await ctx.params;
  const key = parts.join("/");
  if (visibility !== "public" && visibility !== "private") return new NextResponse("Not found", { status: 404 });

  if (visibility === "private") {
    const user = await getCurrentUser();
    if (!user || !(await canReadPrivate(key, user))) return new NextResponse("Not found", { status: 404 });
    if (integrations.supabaseStorage()) {
      const url = await signedUrl(key, 120);
      return url ? NextResponse.redirect(url) : new NextResponse("Not found", { status: 404 });
    }
  }

  let body: Buffer | null = null;
  try {
    body = await getObject(key, visibility);
  } catch {
    body = null;
  }
  if (!body) return new NextResponse("Not found", { status: 404 });

  const ext = key.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
      "x-content-type-options": "nosniff",
      ...(ext === "json" || ext === "zip" ? { "content-disposition": `attachment; filename="${key.split("/").pop()}"` } : {}),
    },
  });
}
