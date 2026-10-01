import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const schema = z.object({ analytics: z.boolean(), marketing: z.boolean(), version: z.string().max(20) });

function ipHash(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(`${ip}:${process.env.BETTER_AUTH_SECRET}`).digest("hex").slice(0, 32);
}

/** Records cookie consent (UK GDPR Art. 7(1): we must be able to demonstrate consent). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { analytics, marketing, version } = parsed.data;

  const session = await getSession();
  const anonymousId = req.cookies.get("pa_aid")?.value ?? randomUUID();
  const base = {
    userId: session?.user.id ?? null,
    anonymousId,
    version,
    ipHash: ipHash(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  };
  await db.consentRecord.createMany({
    data: [
      { ...base, purpose: "analytics", granted: analytics },
      { ...base, purpose: "marketing", granted: marketing },
    ],
  });

  const res = NextResponse.json({ ok: true });
  const cookieOpts = { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" as const, secure: req.nextUrl.protocol === "https:" };
  res.cookies.set("pa_consent", JSON.stringify({ analytics, marketing, version }), cookieOpts);
  res.cookies.set("pa_aid", anonymousId, { ...cookieOpts, httpOnly: true });
  return res;
}
