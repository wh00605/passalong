"use client";
import { useFormStatus } from "react-dom";
import { clsx } from "clsx";
import { createContext, useActionState, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { initialActionState, type ActionState } from "@/lib/action-types";

const FormStateContext = createContext<ActionState | undefined>(undefined);

/**
 * Wraps a server action form. Fields inside read validation errors from context,
 * so server components can render forms without their own client wrapper.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
  submitLabel,
  submitClassName = "btn-primary",
  redirectOnOk,
  encType,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  submitClassName?: string;
  redirectOnOk?: string;
  encType?: "multipart/form-data";
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    const next = (state.data?.next as string | undefined) || redirectOnOk;
    if (next) router.push(next);
  }, [state, redirectOnOk, router]);
  return (
    <FormStateContext.Provider value={state}>
      <form action={formAction} className={className} noValidate encType={encType}>
        <FormMessage state={state} />
        {children}
        {submitLabel && <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>}
      </form>
    </FormStateContext.Provider>
  );
}

export function useFormActionState() {
  return useContext(FormStateContext);
}

export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-primary",
  ...rest
}: { children: ReactNode; pendingLabel?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} aria-disabled={pending} {...rest}>
      {pending ? (pendingLabel ?? "Please wait…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <div role="alert" className="rounded-none border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
        {state.error}
      </div>
    );
  }
  if (state.message) {
    return (
      <div role="status" className="rounded-none border border-success bg-success-bg px-4 py-3 text-sm text-success">
        {state.message}
      </div>
    );
  }
  return null;
}

type FieldProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  state?: ActionState;
  className?: string;
  children?: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "children">;

/** Labelled input with hint and error text wired up via aria-describedby. */
export function Field({ name, label, hint, state: stateProp, className, children, textarea, rows, options, ...input }: FieldProps & { textarea?: boolean; rows?: number; options?: { value: string; label: string }[] }) {
  const ctx = useContext(FormStateContext);
  const state = stateProp ?? ctx;
  const id = `f-${name}`;
  const errors = state?.fieldErrors?.[name];
  const describedBy = clsx(hint && `${id}-hint`, errors?.length && `${id}-error`) || undefined;
  const a11y = { id, "aria-describedby": describedBy, "aria-invalid": errors?.length ? true : undefined };
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {input.required && <span aria-hidden="true" className="text-danger"> *</span>}
      </label>
      {children ? (
        children(a11y)
      ) : textarea ? (
        <textarea name={name} className="input" rows={rows ?? 4} maxLength={input.maxLength} required={input.required} placeholder={input.placeholder} {...a11y} defaultValue={state?.values?.[name] ?? (input.defaultValue as string | undefined)} />
      ) : options ? (
        <select name={name} className="input" required={input.required} {...a11y} defaultValue={state?.values?.[name] ?? (input.defaultValue as string | undefined)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input name={name} className="input" {...a11y} {...input} defaultValue={state?.values?.[name] ?? input.defaultValue} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-danger">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
