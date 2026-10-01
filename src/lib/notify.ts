import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { integrations, siteUrl } from "@/lib/env";
import type { NotificationType } from "@/generated/prisma/enums";

let vapidReady = false;
function ensureVapid() {
  if (vapidReady || !integrations.webPush()) return vapidReady;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:support@passalong.co.uk",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidReady = true;
  return true;
}

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Relative URL, e.g. /orders/abc */
  url?: string;
  /** Extra email paragraphs; defaults to [body]. */
  emailParagraphs?: string[];
  /** Force email regardless of preference (security/legal notices). */
  forceEmail?: boolean;
  /** Skip email this time (e.g. throttling chat emails). */
  skipEmail?: boolean;
};

/**
 * Sends a notification on each channel the member has switched on for this type.
 * Failures on one channel never block the others.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      email: true, name: true, deletedAt: true,
      notificationPrefs: { where: { type: input.type } },
      pushSubscriptions: true,
    },
  });
  if (!user || user.deletedAt) return;
  const pref = user.notificationPrefs[0] ?? { inApp: true, email: true, push: true };
  const tasks: Promise<unknown>[] = [];

  if (pref.inApp) {
    tasks.push(db.notification.create({ data: { userId: input.userId, type: input.type, title: input.title, body: input.body, url: input.url } }));
  }

  if (!input.skipEmail && (pref.email || input.forceEmail || input.type === "ACCOUNT")) {
    tasks.push(
      sendEmail({
        to: user.email,
        subject: input.title,
        paragraphs: [`Hi ${user.name},`, ...(input.emailParagraphs ?? [input.body])],
        action: input.url ? { label: "View on Passalong", url: `${siteUrl}${input.url}` } : undefined,
      }),
    );
  }

  if (pref.push && user.pushSubscriptions.length && ensureVapid()) {
    const payload = JSON.stringify({ title: input.title, body: input.body, url: input.url ?? "/" });
    for (const sub of user.pushSubscriptions) {
      tasks.push(
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 60 * 60 * 24 })
          .catch(async (err: { statusCode?: number }) => {
            // 404/410 = subscription expired; remove it.
            if (err.statusCode === 404 || err.statusCode === 410) {
              await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }),
      );
    }
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") console.error("[notify]", r.reason);
}
