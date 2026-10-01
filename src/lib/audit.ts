import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** Every admin/moderator action goes through here so it's recorded in the audit log. */
export async function audit(actorId: string, action: string, targetType: string, targetId: string | null, metadata?: Prisma.InputJsonValue) {
  await db.adminAuditLog.create({ data: { actorId, action, targetType, targetId, metadata } });
}
