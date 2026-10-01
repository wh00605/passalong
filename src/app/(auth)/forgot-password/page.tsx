"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-types";
import { forgotPasswordAction } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, initialActionState);
  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
      <form action={action} className="space-y-4" noValidate>
        <FormMessage state={state} />
        <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
        <SubmitButton className="btn-primary w-full">Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-sm">
        <Link href="/login" className="link">Back to log in</Link>
      </p>
    </>
  );
}
