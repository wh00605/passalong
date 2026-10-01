"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-types";
import { resetPasswordAction } from "../actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." required state={state} />
      <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required state={state} />
      <SubmitButton className="btn-primary w-full">Save password</SubmitButton>
    </form>
  );
}
