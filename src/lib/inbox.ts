import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

export const getUnreadCounts = cache(async (userId: string) => {
  const [rows, notifications] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Conversation" c
      WHERE (c."buyerId" = ${userId} AND c."lastMessageAt" > COALESCE(c."buyerLastReadAt", 'epoch'::timestamp))
         OR (c."sellerId" = ${userId} AND c."lastMessageAt" > COALESCE(c."sellerLastReadAt", 'epoch'::timestamp))`,
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { messages: Number(rows[0]?.count ?? 0), notifications };
});
