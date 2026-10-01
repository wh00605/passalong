"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction } from "@/lib/action";
import { requireUserForAction, ActionError } from "@/lib/session";
import { parseSearchParams } from "@/lib/search-params";

export async function saveSearchAction(input: { query: string; name: string }) {
  return safeAction(async () => {
    const { query, name } = z.object({ query: z.string().max(2000), name: z.string().trim().min(1).max(80) }).parse(input);
    const me = await requireUserForAction();
    const count = await db.savedSearch.count({ where: { userId: me.id } });
    if (count >= 50) throw new ActionError("You can save up to 50 searches. Delete some first.");
    const raw: Record<string, string[]> = {};
    for (const [k, v] of new URLSearchParams(query)) (raw[k] ??= []).push(v);
    const parsed = parseSearchParams(raw);
    delete parsed.page;
    delete parsed.sort;
    const saved = await db.savedSearch.create({
      data: { userId: me.id, name, query: parsed.q ?? "", filters: JSON.parse(JSON.stringify(parsed)), lastCheckedAt: new Date() },
    });
    revalidatePath("/saved-searches");
    return { id: saved.id };
  });
}

export async function deleteSavedSearchAction(id: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await db.savedSearch.deleteMany({ where: { id, userId: me.id } });
    revalidatePath("/saved-searches");
  });
}

export async function toggleSavedSearchAlertsAction(id: string, enabled: boolean) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await db.savedSearch.updateMany({ where: { id, userId: me.id }, data: { alertsEnabled: enabled, lastCheckedAt: new Date() } });
    revalidatePath("/saved-searches");
  });
}
