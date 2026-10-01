"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-types";
import { logInAction } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(logInAction, initialActionState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" required state={state} />
      <p className="text-sm">
        <Link href="/forgot-password" className="link">Forgotten your password?</Link>
      </p>
      <SubmitButton className="btn-primary w-full" pendingLabel="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
