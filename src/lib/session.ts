import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";

export { ActionError };

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Returns the full user row for the signed-in member, or null. Also records "last active". */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.deletedAt) return null;
  // Throttle last-active writes to once every 5 minutes.
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > 5 * 60_000) {
    await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
  }
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function requireUserForAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Please log in to continue.");
  if (!user.emailVerified) throw new ActionError("Please confirm your email address first.");
  if (user.banned && (!user.banExpires || user.banExpires > new Date())) {
    throw new ActionError("Your account is restricted. Contact support for help.");
  }
  return user;
}

export function isStaff(user: { role: string } | null | undefined) {
  return user?.role === "admin" || user?.role === "moderator";
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!isStaff(user)) forbidden();
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") forbidden();
  return user;
}
