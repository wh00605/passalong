"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-types";
import { resendVerificationAction } from "../actions";

export function ResendForm() {
  const [state, action] = useActionState(resendVerificationAction, initialActionState);
  return (
    <form action={action} className="mt-3 space-y-3" noValidate>
      <FormMessage state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <SubmitButton className="btn-secondary w-full">Send a new link</SubmitButton>
    </form>
  );
}
