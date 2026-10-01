"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/session";
import { safeAction } from "@/lib/action";

export async function markAllNotificationsReadAction() {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await db.notification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
  });
}
