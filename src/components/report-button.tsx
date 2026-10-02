"use client";
import { useActionState, useEffect, useId, useRef } from "react";
import { Flag } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-types";
import { REPORT_REASONS, type ReportTargetType } from "@/lib/report-reasons";
import { createReportAction } from "@/app/actions/reports";

export function ReportButton({
  targetType,
  targetId,
  label = "Report",
  className = "btn-ghost btn-sm text-muted",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action] = useActionState(createReportAction, initialActionState);

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => ref.current?.close(), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const noun = targetType === "LISTING" ? "item" : targetType === "USER" ? "member" : "message";

  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        <Flag className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      <dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-line p-0 shadow-[var(--shadow-tag)] backdrop:bg-ink/60">
        <form action={action} className="space-y-4 p-6">
          <h2 id={titleId} className="text-lg font-bold">Report this {noun}</h2>
          <FormMessage state={state} />
          {!state.ok && (
            <>
              <input type="hidden" name="targetType" value={targetType} />
              <input type="hidden" name="targetId" value={targetId} />
              <fieldset>
                <legend className="label">What&apos;s wrong?</legend>
                <div className="space-y-1">
                  {REPORT_REASONS[targetType].map(([value, text]) => (
                    <label key={value} className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-brand-50">
                      <input type="radio" name="reason" value={value} required className="h-4 w-4" />
                      {text}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor={`${titleId}-details`} className="label">Tell us more (optional)</label>
                <textarea id={`${titleId}-details`} name="details" rows={3} maxLength={1000} className="input" />
              </div>
              <p className="text-xs text-muted">
                Reports are confidential – the member won&apos;t know who reported them. To report illegal content formally, use our{" "}
                <a href="/report-illegal-content" className="link">illegal content form</a>.
              </p>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>
              {state.ok ? "Close" : "Cancel"}
            </button>
            {!state.ok && <SubmitButton>Send report</SubmitButton>}
          </div>
        </form>
      </dialog>
    </>
  );
}
