import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { integrations } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import { SocialButtons } from "../social-buttons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        New to Passalong? <Link href="/signup" className="link">Create an account</Link>
      </p>
      {sp.reset === "1" && (
        <p role="status" className="mb-4 rounded-none bg-success-bg px-4 py-3 text-sm text-success">
          Your password has been changed. Please log in.
        </p>
      )}
      <SocialButtons google={integrations.google()} apple={integrations.apple()} next={next} />
      <LoginForm next={next} />
    </>
  );
}
