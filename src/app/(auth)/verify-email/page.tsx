import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const failed = typeof sp.error === "string";
  return (
    <>
      <MailCheck className="h-10 w-10 text-brand-600" aria-hidden="true" />
      <h1 className="mt-3 text-2xl font-bold">{failed ? "That link didn't work" : "Check your email"}</h1>
      <p className="mt-2 text-muted">
        {failed
          ? "The confirmation link has expired or was already used. Enter your email and we'll send a new one."
          : "We've sent you a link to confirm your email address. Open it on this device to finish creating your account. It can take a minute to arrive – check your spam folder too."}
      </p>
      <h2 className="mt-6 text-base font-semibold">Didn&apos;t get it?</h2>
      <ResendForm />
    </>
  );
}
