import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_SETTINGS, type PlatformSettings } from "@/lib/settings-defaults";

export { DEFAULT_SETTINGS, type PlatformSettings };

/** Platform settings: defaults overridden by rows in PlatformSetting (editable in /admin/fees). */
export const getSettings = cache(async (): Promise<PlatformSettings> => {
  const rows = await db.platformSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS && typeof row.value === typeof merged[row.key]) {
      merged[row.key] = row.value;
    }
  }
  return merged as PlatformSettings;
});
