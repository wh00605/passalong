import Link from "next/link";
import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token || sp.error) {
    return (
      <>
        <h1 className="text-2xl font-bold">This link has expired</h1>
        <p className="mt-2 text-muted">Password reset links work for one hour and can only be used once.</p>
        <Link href="/forgot-password" className="btn-primary mt-6 w-full">Request a new link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-muted">You&apos;ll be logged out on your other devices.</p>
      <ResetForm token={token} />
    </>
  );
}
