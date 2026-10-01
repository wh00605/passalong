import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm, Field } from "@/components/ui/form";
import { formatDate, formatDateTime } from "@/lib/time";
import { requestDeletionAction } from "../actions";
import { ExportButton, CancelDeletionButton } from "./data-buttons";

export default async function DataPage() {
  const user = await requireUser();
  const [exports, deletion] = await Promise.all([
    db.dataExportRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.deletionRequest.findFirst({ where: { userId: user.id, status: "PENDING" } }),
  ]);
  return (
    <div className="space-y-10">
      <section aria-labelledby="export-h">
        <h2 id="export-h" className="text-2xl font-medium">Download your data</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Get a copy of the personal data we hold about you – your profile, listings, orders, messages, reviews and settings – as a JSON file.
        </p>
        <ExportButton />
        {exports.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm" role="list">
            {exports.map((e) => (
              <li key={e.id} className="font-mono text-xs text-muted">
                {formatDateTime(e.createdAt)} – {e.status.toLowerCase()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="delete-h" className="rounded-none border border-danger p-5">
        <h2 id="delete-h" className="text-2xl font-medium text-danger">Delete your account</h2>
        {deletion ? (
          <>
            <p className="mt-2">
              Your account is scheduled for deletion on <strong>{formatDate(deletion.scheduledFor)}</strong>. Your items are hidden until then.
            </p>
            <CancelDeletionButton />
          </>
        ) : (
          <>
            <ul className="mt-2 max-w-xl list-disc space-y-1 pl-5 text-sm">
              <li>Your listings are hidden straight away and your account is deleted after 14 days.</li>
              <li>You can cancel during those 14 days.</li>
              <li>Your profile, photos, favourites and messages are removed. Reviews you wrote are anonymised.</li>
              <li>We keep order, payment and tax records for 6 years where UK law requires it.</li>
              <li>You need to finish any orders in progress first.</li>
            </ul>
            <ActionForm action={requestDeletionAction} className="mt-4 max-w-md space-y-4" submitLabel="Delete my account" submitClassName="btn-danger">
              <Field name="reason" label="Why are you leaving? (optional)" maxLength={500} />
              <Field name="confirm" label='Type "DELETE" to confirm' required autoComplete="off" />
            </ActionForm>
          </>
        )}
      </section>
    </div>
  );
}
