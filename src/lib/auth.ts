import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { integrations, siteUrl } from "@/lib/env";
import { normaliseUsername, usernameFromName, validateUsername } from "@/lib/username";
import { createDefaultNotificationPrefs } from "@/lib/notification-prefs";

async function uniqueUsername(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = `${base.slice(0, 15)}${Math.floor(Math.random() * 10_000)}`;
  }
  throw new APIError("BAD_REQUEST", { message: "Could not create a username. Please try again." });
}

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
if (integrations.google()) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  };
}
if (integrations.apple()) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID!,
    clientSecret: process.env.APPLE_CLIENT_SECRET!,
    appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
  };
}

export const auth = betterAuth({
  baseURL: siteUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: [siteUrl, "https://appleid.apple.com"],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Passalong password",
        paragraphs: [
          `Hi ${user.name},`,
          "Someone asked to reset the password for your Passalong account. If that was you, use the button below. The link works for one hour.",
          "If you didn't ask for this, you can ignore this email – your password won't change.",
        ],
        action: { label: "Reset password", url },
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Confirm your email for Passalong",
        paragraphs: [
          `Hi ${user.name},`,
          "Welcome to Passalong! Please confirm your email address so you can start buying and selling. The link works for 24 hours.",
        ],
        action: { label: "Confirm email", url },
      });
    },
  },
  socialProviders,
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: true },
    },
    deleteUser: { enabled: false }, // Deletion goes through our own GDPR flow (/settings/data).
    changeEmail: {
      enabled: true,
      // Verified members confirm from their CURRENT address first (protects against account takeover).
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Confirm your new Passalong email address",
          paragraphs: [
            `Hi ${user.name},`,
            `You asked to change your Passalong email to ${newEmail}. If that was you, confirm below. If not, ignore this email and consider changing your password.`,
          ],
          action: { label: "Confirm change", url },
        });
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 10, max: 3 },
      "/send-verification-email": { window: 60 * 10, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: siteUrl.startsWith("https://"),
    database: { generateId: () => crypto.randomUUID() },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const requested = typeof user.username === "string" ? normaliseUsername(user.username) : "";
          let username: string;
          if (requested) {
            const problem = validateUsername(requested);
            if (problem) throw new APIError("BAD_REQUEST", { message: problem });
            const taken = await db.user.findUnique({ where: { username: requested }, select: { id: true } });
            if (taken) throw new APIError("BAD_REQUEST", { message: "That username is taken." });
            username = requested;
          } else {
            username = await uniqueUsername(usernameFromName(user.name || user.email.split("@")[0]));
          }
          return { data: { ...user, username, name: user.name?.trim().slice(0, 60) || username } };
        },
        after: async (user) => {
          await createDefaultNotificationPrefs(user.id);
        },
      },
    },
  },
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(), // must be last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
