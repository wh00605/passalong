import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Reject anything else. */
export function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function cronHandler(job: () => Promise<unknown>) {
  return async (req: Request) => {
    if (!verifyCron(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const started = Date.now();
    try {
      const result = await job();
      return NextResponse.json({ ok: true, ms: Date.now() - started, result });
    } catch (err) {
      console.error("[cron]", err);
      return NextResponse.json({ ok: false, error: "Job failed" }, { status: 500 });
    }
  };
}
