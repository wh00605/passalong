"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validatedAction } from "@/lib/action";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { USERNAME_PATTERN } from "@/lib/username";
import { safeNext } from "@/lib/safe-next";

const TERMS_VERSION = "2026-10-01";

const email = z.email("Enter a valid email address.").max(254).transform((e) => e.trim().toLowerCase());
const password = z
  .string()
  .min(10, "Passwords need at least 10 characters.")
  .max(128, "Passwords can be at most 128 characters.");

function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof APIError) return (err.body as { code?: string } | undefined)?.code;
  return undefined;
}

export const signUpAction = validatedAction(
  z.object({
    name: z.string().trim().min(2, "Enter your name.").max(60),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(USERNAME_PATTERN, "Usernames are 3–20 characters: lowercase letters, numbers and underscores."),
    email,
    password,
    terms: z.literal("on", { error: "You need to accept the terms to create an account." }),
  }),
  async (data) => {
    await enforceRateLimit("signup", await clientIp(), 5, 600);
    const taken = await db.user.findUnique({ where: { username: data.username }, select: { id: true } });
    if (taken) return { error: "Please check the highlighted fields.", fieldErrors: { username: ["That username is taken."] }, values: { name: data.name, username: data.username, email: data.email } };

    try {
      await auth.api.signUpEmail({
        body: { name: data.name, email: data.email, password: data.password, username: data.username, callbackURL: "/welcome" },
        headers: await headers(),
      });
    } catch (err) {
      if (err instanceof APIError) return { error: err.message || "We couldn't create your account.", values: { name: data.name, username: data.username, email: data.email } };
      throw err;
    }

    // Record acceptance of terms and privacy notice (only for a genuinely new account).
    const user = await db.user.findUnique({ where: { email: data.email }, select: { id: true, createdAt: true } });
    if (user && Date.now() - user.createdAt.getTime() < 60_000) {
      await db.consentRecord.createMany({
        data: [
          { userId: user.id, purpose: "terms", granted: true, version: TERMS_VERSION },
          { userId: user.id, purpose: "privacy", granted: true, version: TERMS_VERSION },
        ],
      });
    }
    redirect("/verify-email");
  },
);

export const logInAction = validatedAction(
  z.object({ email, password: z.string().min(1, "Enter your password.").max(128), next: z.string().optional() }),
  async (data) => {
    await enforceRateLimit("login", `${await clientIp()}:${data.email}`, 10, 600);
    try {
      await auth.api.signInEmail({
        body: { email: data.email, password: data.password },
        headers: await headers(),
      });
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "EMAIL_NOT_VERIFIED") {
        return { error: "Please confirm your email address first. We've just sent you a new link.", values: { email: data.email } };
      }
      if (code === "BANNED_USER") {
        return { error: "This account has been restricted. Please contact support if you think this is a mistake.", values: { email: data.email } };
      }
      if (err instanceof APIError) return { error: "Incorrect email or password.", values: { email: data.email } };
      throw err;
    }
    redirect(safeNext(data.next));
  },
);

export const forgotPasswordAction = validatedAction(z.object({ email }), async (data) => {
  await enforceRateLimit("forgot", await clientIp(), 5, 600);
  try {
    await auth.api.requestPasswordReset({ body: { email: data.email, redirectTo: "/reset-password" }, headers: await headers() });
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
  }
  // Same response whether or not the account exists (prevents account enumeration).
  return { ok: true, message: "If there's an account for that email, we've sent a link to reset your password." };
});

export const resetPasswordAction = validatedAction(
  z
    .object({ token: z.string().min(10), password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match." }),
  async (data) => {
    try {
      await auth.api.resetPassword({ body: { newPassword: data.password, token: data.token }, headers: await headers() });
    } catch (err) {
      if (err instanceof APIError) return { error: "This reset link has expired or already been used. Please request a new one." };
      throw err;
    }
    redirect("/login?reset=1");
  },
);

export const resendVerificationAction = validatedAction(z.object({ email }), async (data) => {
  await enforceRateLimit("verify-resend", await clientIp(), 3, 600);
  try {
    await auth.api.sendVerificationEmail({ body: { email: data.email, callbackURL: "/welcome" }, headers: await headers() });
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
  }
  return { ok: true, message: "If that account needs confirming, we've sent a new link." };
});
