"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Field = "reason" | "amount" | "days" | "title" | "body";
const LABELS: Record<Field, string> = { reason: "Reason (sent to the member)", amount: "Amount (£)", days: "Days", title: "Title", body: "Message" };

/**
 * Button for an admin server action. `action` is a server action with its leading arguments
 * already bound; the remaining arguments are collected from `fields`, in order.
 */
export function AdminAction({
  action,
  label,
  fields = [],
  danger = false,
  confirmText,
  className,
}: {
  action: (...args: never[]) => Promise<{ ok: boolean; error?: string } | { ok: true; data: unknown }>;
  label: string;
  fields?: Field[];
  danger?: boolean;
  confirmText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const uid = useId();

  function run() {
    if (confirmText && !confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const args = fields.map((f) => (f === "days" ? Number(values[f] ?? 0) : (values[f] ?? "")));
      const res = await (action as (...a: unknown[]) => Promise<{ ok: boolean; error?: string }>)(...args);
      if (res.ok) {
        setMsg({ ok: true, text: "Done." });
        setOpen(false);
        setValues({});
        router.refresh();
      } else setMsg({ ok: false, text: res.error ?? "Failed." });
    });
  }

  const btn = className ?? (danger ? "btn-danger btn-sm" : "btn-secondary btn-sm");
  if (fields.length === 0) {
    return (
      <span className="inline-flex flex-col">
        <button type="button" className={btn} disabled={pending} onClick={run}>{pending ? "…" : label}</button>
        {msg && !msg.ok && <span role="alert" className="text-xs text-danger">{msg.text}</span>}
      </span>
    );
  }
  return (
    <span className="inline-block">
      {!open ? (
        <button type="button" className={btn} onClick={() => setOpen(true)}>{label}</button>
      ) : (
        <span className="block space-y-2 rounded-lg border border-line bg-surface p-3">
          {fields.map((f) => (
            <span key={f} className="block">
              <label htmlFor={`${uid}-${f}`} className="label text-xs">{LABELS[f]}</label>
              {f === "reason" || f === "body" ? (
                <textarea id={`${uid}-${f}`} rows={2} className="input text-sm" value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
              ) : (
                <input id={`${uid}-${f}`} inputMode={f === "title" ? "text" : "decimal"} className="input text-sm" value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
              )}
            </span>
          ))}
          <span className="flex gap-2">
            <button type="button" className={danger ? "btn-danger btn-sm" : "btn-primary btn-sm"} disabled={pending} onClick={run}>{pending ? "Working…" : `Confirm: ${label}`}</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
          </span>
        </span>
      )}
      {msg && <span role={msg.ok ? "status" : "alert"} className={`block text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
    </span>
  );
}
