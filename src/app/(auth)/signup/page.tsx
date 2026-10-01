import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { integrations } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { SocialButtons } from "../social-buttons";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <>
      <h1 className="text-2xl font-bold">Join Passalong</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Already a member? <Link href="/login" className="link">Log in</Link>
      </p>
      <SocialButtons google={integrations.google()} apple={integrations.apple()} />
      <SignUpForm />
    </>
  );
}
