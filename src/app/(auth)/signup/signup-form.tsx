"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-types";
import { signUpAction } from "../actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialActionState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field name="name" label="Your name" autoComplete="name" required state={state} maxLength={60} />
      <Field
        name="username"
        label="Username"
        hint="This is shown on your profile. Lowercase letters, numbers and underscores."
        autoComplete="username"
        required
        state={state}
        maxLength={20}
        autoCapitalize="none"
        spellCheck={false}
      />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. A short phrase is easy to remember."
        required
        state={state}
        minLength={10}
      />
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="terms"
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-describedby={state.fieldErrors?.terms ? "terms-error" : undefined}
            aria-invalid={state.fieldErrors?.terms ? true : undefined}
          />
          <span>
            I agree to the <Link href="/legal/terms" className="link" target="_blank">Terms of service</Link> and
            have read the <Link href="/legal/privacy" className="link" target="_blank">Privacy policy</Link>. I am 18 or over.
          </span>
        </label>
        {state.fieldErrors?.terms && (
          <p id="terms-error" className="mt-1 text-sm font-medium text-danger">
            {state.fieldErrors.terms[0]}
          </p>
        )}
      </div>
      <SubmitButton className="btn-primary w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
