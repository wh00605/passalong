import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/ui/form";
import { NOTIFICATION_LABELS } from "@/lib/notification-prefs";
import { integrations } from "@/lib/env";
import { NotificationType } from "@/generated/prisma/enums";
import { saveNotificationPrefsAction } from "../actions";
import { EnablePush } from "./enable-push";

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const prefs = await db.notificationPreference.findMany({ where: { userId: user.id } });
  const byType = new Map(prefs.map((p) => [p.type, p]));
  const types = Object.values(NotificationType);

  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-medium">Notifications</h2>
      <p className="mt-1 text-sm text-muted">Choose how we tell you about each kind of update.</p>

      <div className="mt-4">
        {integrations.webPush() ? (
          <EnablePush vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!} />
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong/60 p-3 text-sm text-muted">
            Browser push notifications aren&apos;t set up on this site yet.
          </p>
        )}
      </div>

      <ActionForm action={saveNotificationPrefsAction} className="mt-6 space-y-4" submitLabel="Save notification settings">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Notification channels for each type of update</caption>
            <thead className="bg-brand-600 text-white">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase">Update</th>
                {["In app", "Email", "Push"].map((h) => (
                  <th key={h} scope="col" className="w-20 px-2 py-3 text-center font-mono text-xs tracking-wider uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((type, i) => {
                const p = byType.get(type) ?? { inApp: type !== "MARKETING", email: type !== "MARKETING", push: type !== "MARKETING" };
                const meta = NOTIFICATION_LABELS[type];
                return (
                  <tr key={type} className={i % 2 ? "bg-canvas" : "bg-surface"}>
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="block font-semibold">{meta.label}</span>
                      <span className="text-muted">{meta.description}</span>
                    </th>
                    {(["inApp", "email", "push"] as const).map((ch) => (
                      <td key={ch} className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          name={`${type}.${ch}`}
                          defaultChecked={type === "ACCOUNT" && ch === "email" ? true : p[ch]}
                          disabled={type === "ACCOUNT" && ch === "email"}
                          aria-label={`${meta.label} by ${ch === "inApp" ? "in-app notification" : ch}`}
                          className="h-5 w-5 accent-ink"
                        />
                        {type === "ACCOUNT" && ch === "email" && <input type="hidden" name={`${type}.${ch}`} value="on" />}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Security and legal notices are always emailed.</p>
      </ActionForm>
    </section>
  );
}
