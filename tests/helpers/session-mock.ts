import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";

/**
 * Lets tests act as a given member when calling server actions. Usage in a test file:
 *   vi.mock("@/lib/session", async () => (await import("../helpers/session-mock")).sessionModule());
 *   vi.mock("next/headers", async () => (await import("../helpers/session-mock")).headersModule());
 */
export const actingAs = { userId: null as string | null };

export function sessionModule() {
  const load = async () => (actingAs.userId ? db.user.findUnique({ where: { id: actingAs.userId } }) : null);
  return {
    ActionError,
    getSession: async () => null,
    getCurrentUser: load,
    requireUser: async () => {
      const u = await load();
      if (!u) throw new Error("not signed in");
      return u;
    },
    requireUserForAction: async () => {
      const u = await load();
      if (!u) throw new ActionError("Please log in to continue.");
      return u;
    },
    isStaff: (u: { role: string } | null) => u?.role === "admin" || u?.role === "moderator",
    requireStaff: load,
    requireAdmin: load,
  };
}

export function headersModule() {
  return {
    headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
    cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  };
}

export function form(data: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
