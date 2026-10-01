import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { db } from "@/lib/db";
import { integrations } from "@/lib/env";
import { ActionError } from "@/lib/errors";

const upstash = new Map<string, Ratelimit>();

function upstashLimiter(limit: number, windowSec: number) {
  const id = `${limit}:${windowSec}`;
  let rl = upstash.get(id);
  if (!rl) {
    rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "pa:rl",
    });
    upstash.set(id, rl);
  }
  return rl;
}

/** Fixed-window counter in Postgres – works across serverless instances without Redis. */
async function dbLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${crypto.randomUUID()}, ${`app:${key}`}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rateLimit"."lastRequest" < ${BigInt(windowStart)} THEN 1 ELSE "rateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "rateLimit"."lastRequest" < ${BigInt(windowStart)} THEN ${BigInt(now)} ELSE "rateLimit"."lastRequest" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit;
}

/** Returns true if the action is allowed. */
export async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (process.env.DISABLE_RATE_LIMIT === "true") return true;
  if (integrations.upstash()) {
    const { success } = await upstashLimiter(limit, windowSec).limit(key);
    return success;
  }
  return dbLimit(key, limit, windowSec);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Throws a user-facing error when the limit is exceeded. */
export async function enforceRateLimit(scope: string, identity: string, limit: number, windowSec: number) {
  const ok = await checkRateLimit(`${scope}:${identity}`, limit, windowSec);
  if (!ok) throw new ActionError("You're doing that too often. Please wait a few minutes and try again.");
}
