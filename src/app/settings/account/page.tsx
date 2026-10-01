import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm, Field } from "@/components/ui/form";
import { formatDateTime } from "@/lib/time";
import { changeEmailAction, changePasswordAction } from "../actions";

export default async function AccountSettingsPage() {
  const user = await requireUser();
  const [accounts, sessions] = await Promise.all([
    db.account.findMany({ where: { userId: user.id }, select: { providerId: true } }),
    db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: "desc" }, select: { id: true, userAgent: true, updatedAt: true } }),
  ]);
  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const providers = accounts.filter((a) => a.providerId !== "credential").map((a) => a.providerId);

  return (
    <div className="space-y-10">
      <section aria-labelledby="email-h">
        <h2 id="email-h" className="text-2xl font-medium">Email</h2>
        <p className="mt-1 text-sm text-muted">
          Currently <strong className="text-ink">{user.email}</strong> {user.emailVerified ? "(confirmed)" : "(not confirmed)"}
        </p>
        <ActionForm action={changeEmailAction} className="mt-4 max-w-xl space-y-4" submitLabel="Change email" submitClassName="btn-secondary">
          <Field name="newEmail" label="New email address" type="email" autoComplete="email" required />
        </ActionForm>
      </section>

      <section aria-labelledby="pw-h">
        <h2 id="pw-h" className="text-2xl font-medium">Password</h2>
        {hasPassword ? (
          <ActionForm action={changePasswordAction} className="mt-4 max-w-xl space-y-4" submitLabel="Change password" submitClassName="btn-secondary">
            <Field name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
            <Field name="newPassword" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." required />
            <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
          </ActionForm>
        ) : (
          <p className="mt-2 text-sm text-muted">
            You sign in with {providers.join(" and ")}. To add a password, use <a href="/forgot-password" className="link">reset password</a>.
          </p>
        )}
      </section>

      <section aria-labelledby="linked-h">
        <h2 id="linked-h" className="text-2xl font-medium">Sign-in methods</h2>
        <ul className="mt-3 space-y-2 text-sm" role="list">
          {hasPassword && <li className="card px-4 py-3">Email and password</li>}
          {providers.map((p) => (
            <li key={p} className="card px-4 py-3 capitalize">{p}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sessions-h">
        <h2 id="sessions-h" className="text-2xl font-medium">Where you&apos;re signed in</h2>
        <ul className="mt-3 space-y-2 text-sm" role="list">
          {sessions.map((s) => (
            <li key={s.id} className="card flex justify-between gap-4 px-4 py-3">
              <span className="line-clamp-1">{s.userAgent ?? "Unknown device"}</span>
              <span className="shrink-0 font-mono text-xs text-muted">{formatDateTime(s.updatedAt)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">Changing your password signs you out everywhere else.</p>
      </section>
    </div>
  );
}
