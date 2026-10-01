import "server-only";
import { db } from "@/lib/db";

/** True if either member has blocked the other. */
export async function isBlockedBetween(a: string, b: string) {
  const n = await db.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
  return n > 0;
}
