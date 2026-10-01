"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { validatedAction, safeAction } from "@/lib/action";
import { requireUserForAction, ActionError } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { processAndStoreImage, ImageError } from "@/lib/images";
import { photoUrl } from "@/lib/storage";
import { USERNAME_PATTERN, validateUsername } from "@/lib/username";
import { NotificationType } from "@/generated/prisma/enums";
import { addDays } from "@/lib/time";
import { sendEmail } from "@/lib/email";
import { buildDataExport } from "@/lib/data-export";
import { putObject } from "@/lib/storage";

const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;

export const updateProfileAction = validatedAction(
  z.object({
    name: z.string().trim().min(2, "Enter your name.").max(60),
    username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN, "Usernames are 3–20 characters: lowercase letters, numbers and underscores."),
    bio: z.string().trim().max(500, "Keep your bio under 500 characters.").optional().default(""),
    location: z.string().trim().max(60).optional().default(""),
  }),
  async (data, form) => {
    const me = await requireUserForAction();
    if (data.username !== me.username) {
      const problem = validateUsername(data.username);
      if (problem) return { error: problem, fieldErrors: { username: [problem] } };
      const taken = await db.user.findFirst({ where: { username: data.username, id: { not: me.id } }, select: { id: true } });
      if (taken) return { error: "That username is taken.", fieldErrors: { username: ["That username is taken."] } };
    }

    let image: string | undefined;
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) {
      await enforceRateLimit("avatar", me.id, 10, 3600);
      try {
        const processed = await processAndStoreImage(Buffer.from(await file.arrayBuffer()), { prefix: `avatars/${me.id}`, visibility: "public" });
        image = photoUrl(processed.storageKey, 320);
      } catch (err) {
        if (err instanceof ImageError) return { error: err.message, fieldErrors: { photo: [err.message] } };
        throw err;
      }
    }

    await db.user.update({
      where: { id: me.id },
      data: { name: data.name, username: data.username, bio: data.bio || null, location: data.location || null, ...(image ? { image } : {}) },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  },
);

export async function removeProfilePhotoAction() {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await db.user.update({ where: { id: me.id }, data: { image: null } });
    revalidatePath("/", "layout");
  });
}

export const changePasswordAction = validatedAction(
  z
    .object({
      currentPassword: z.string().min(1, "Enter your current password."),
      newPassword: z.string().min(10, "Passwords need at least 10 characters.").max(128),
      confirm: z.string(),
    })
    .refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: "Passwords don't match." }),
  async (data) => {
    const me = await requireUserForAction();
    await enforceRateLimit("change-password", me.id, 5, 3600);
    try {
      await auth.api.changePassword({
        body: { currentPassword: data.currentPassword, newPassword: data.newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch (err) {
      if (err instanceof APIError) return { error: "Your current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password."] } };
      throw err;
    }
    return { ok: true, message: "Password changed. You've been signed out on other devices." };
  },
);

export const changeEmailAction = validatedAction(
  z.object({ newEmail: z.email("Enter a valid email address.").transform((e) => e.trim().toLowerCase()) }),
  async (data) => {
    const me = await requireUserForAction();
    await enforceRateLimit("change-email", me.id, 3, 3600);
    try {
      await auth.api.changeEmail({ body: { newEmail: data.newEmail, callbackURL: "/settings/account" }, headers: await headers() });
    } catch (err) {
      if (err instanceof APIError) return { error: err.message || "We couldn't change your email." };
      throw err;
    }
    return { ok: true, message: `We've sent a confirmation link to ${data.newEmail}. Your email changes once you click it.` };
  },
);

export const savePersonalisationAction = validatedAction(
  z.object({
    sizeIds: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v])),
    brandIds: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v])),
    next: z.string().optional(),
  }),
  async (data) => {
    const me = await requireUserForAction();
    const [sizes, brands] = await Promise.all([
      db.size.findMany({ where: { id: { in: data.sizeIds.slice(0, 40) } }, select: { id: true } }),
      db.brand.findMany({ where: { id: { in: data.brandIds.slice(0, 40) } }, select: { id: true } }),
    ]);
    await db.user.update({
      where: { id: me.id },
      data: { preferredSizeIds: sizes.map((s) => s.id), preferredBrandIds: brands.map((b) => b.id) },
    });
    revalidatePath("/");
    return { ok: true, message: "Saved – your feed will now favour these.", data: { next: data.next } };
  },
);

export const saveNotificationPrefsAction = validatedAction(z.object({}).passthrough(), async (_data, form) => {
  const me = await requireUserForAction();
  const types = Object.values(NotificationType);
  await db.$transaction(
    types.map((type) =>
      db.notificationPreference.upsert({
        where: { userId_type: { userId: me.id, type } },
        create: { userId: me.id, type, inApp: form.get(`${type}.inApp`) === "on", email: form.get(`${type}.email`) === "on", push: form.get(`${type}.push`) === "on" },
        update: { inApp: form.get(`${type}.inApp`) === "on", email: form.get(`${type}.email`) === "on", push: form.get(`${type}.push`) === "on" },
      }),
    ),
  );
  return { ok: true, message: "Notification settings saved." };
});

export const savePrivacyAction = validatedAction(
  z.object({ showOnlineStatus: checkbox, allowPersonalisation: checkbox, allowSearchIndexing: checkbox, marketing: checkbox }),
  async (data) => {
    const me = await requireUserForAction();
    await db.$transaction([
      db.user.update({
        where: { id: me.id },
        data: { showOnlineStatus: data.showOnlineStatus, allowPersonalisation: data.allowPersonalisation, allowSearchIndexing: data.allowSearchIndexing },
      }),
      db.notificationPreference.upsert({
        where: { userId_type: { userId: me.id, type: "MARKETING" } },
        create: { userId: me.id, type: "MARKETING", inApp: data.marketing, email: data.marketing, push: false },
        update: { email: data.marketing, inApp: data.marketing },
      }),
      db.consentRecord.create({ data: { userId: me.id, purpose: "marketing_email", granted: data.marketing, version: "2026-10-01" } }),
      db.consentRecord.create({ data: { userId: me.id, purpose: "personalisation", granted: data.allowPersonalisation, version: "2026-10-01" } }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, message: "Privacy settings saved." };
  },
);

const addressSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(2, "Enter the recipient's name.").max(80),
  line1: z.string().trim().min(3, "Enter the first line of the address.").max(100),
  line2: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().min(2, "Enter a town or city.").max(60),
  postcode: z
    .string()
    .trim()
    .regex(UK_POSTCODE, "Enter a valid UK postcode, e.g. SW1A 1AA.")
    .transform((p) => p.toUpperCase().replace(UK_POSTCODE, "$1 $2")),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\s()-]*$/, "Enter a valid phone number.")
    .optional()
    .default(""),
  isDefault: checkbox.optional().default(false),
});

export const saveAddressAction = validatedAction(addressSchema, async (data) => {
  const me = await requireUserForAction();
  const count = await db.address.count({ where: { userId: me.id } });
  if (!data.id && count >= 10) throw new ActionError("You can save up to 10 addresses.");
  const makeDefault = data.isDefault || count === 0;
  await db.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId: me.id }, data: { isDefault: false } });
    const payload = { fullName: data.fullName, line1: data.line1, line2: data.line2 || null, city: data.city, postcode: data.postcode, phone: data.phone || null, isDefault: makeDefault };
    if (data.id) {
      const res = await tx.address.updateMany({ where: { id: data.id, userId: me.id }, data: payload });
      if (res.count === 0) throw new ActionError("Address not found.");
    } else {
      await tx.address.create({ data: { ...payload, userId: me.id } });
    }
  });
  revalidatePath("/settings/addresses");
  return { ok: true, message: "Address saved." };
});

export async function deleteAddressAction(id: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await db.address.deleteMany({ where: { id, userId: me.id } });
    revalidatePath("/settings/addresses");
  });
}

export const saveBundlesAction = validatedAction(
  z.object({
    enabled: checkbox,
    tier2: z.coerce.number().int().min(0).max(50).default(0),
    tier3: z.coerce.number().int().min(0).max(50).default(0),
    tier5: z.coerce.number().int().min(0).max(50).default(0),
  }),
  async (data) => {
    const me = await requireUserForAction();
    const tiers = [
      [2, data.tier2],
      [3, data.tier3],
      [5, data.tier5],
    ].filter(([, pct]) => pct > 0);
    await db.$transaction([
      db.bundleDiscountTier.deleteMany({ where: { sellerId: me.id } }),
      db.bundleDiscountTier.createMany({ data: tiers.map(([minItems, percentOff]) => ({ sellerId: me.id, minItems, percentOff })) }),
      db.user.update({ where: { id: me.id }, data: { bundleDiscountsEnabled: data.enabled && tiers.length > 0 } }),
    ]);
    revalidatePath(`/members/${me.username}`);
    return { ok: true, message: data.enabled && tiers.length ? "Bundle discounts are on." : "Bundle discounts are off." };
  },
);

export const setHolidayModeAction = validatedAction(z.object({ holidayMode: checkbox }), async (data) => {
  const me = await requireUserForAction();
  await db.user.update({ where: { id: me.id }, data: { holidayMode: data.holidayMode } });
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: data.holidayMode
      ? "Holiday mode is on. Your items are hidden from buyers until you switch it off."
      : "Welcome back! Your items are visible again.",
  };
});

export async function requestDataExportAction() {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await enforceRateLimit("data-export", me.id, 3, 86_400);
    const req = await db.dataExportRequest.create({ data: { userId: me.id, status: "PROCESSING" } });
    try {
      const json = await buildDataExport(me.id);
      const key = `exports/${me.id}/passalong-data-${req.id}.json`;
      await putObject(key, Buffer.from(JSON.stringify(json, null, 2)), "application/json", "private");
      await db.dataExportRequest.update({ where: { id: req.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      revalidatePath("/settings/data");
      return { url: `/api/files/private/${key}` };
    } catch (err) {
      await db.dataExportRequest.update({ where: { id: req.id }, data: { status: "FAILED" } });
      throw err;
    }
  });
}

export const requestDeletionAction = validatedAction(
  z.object({ confirm: z.literal("DELETE", { error: 'Type DELETE in capitals to confirm.' }), reason: z.string().trim().max(500).optional() }),
  async (data) => {
    const me = await requireUserForAction();
    const open = await db.order.count({
      where: { OR: [{ buyerId: me.id }, { sellerId: me.id }], status: { in: ["PAID", "SHIPPED", "DELIVERED", "DISPUTED"] } },
    });
    if (open > 0) throw new ActionError("You have orders in progress. Please finish them (or ask support to cancel them) before deleting your account.");
    const existing = await db.deletionRequest.findFirst({ where: { userId: me.id, status: "PENDING" } });
    if (existing) return { ok: true, message: "Your account is already scheduled for deletion." };
    const scheduledFor = addDays(new Date(), 14);
    await db.$transaction([
      db.deletionRequest.create({ data: { userId: me.id, reason: data.reason, scheduledFor } }),
      db.user.update({ where: { id: me.id }, data: { holidayMode: true } }),
    ]);
    await sendEmail({
      to: me.email,
      subject: "Your Passalong account will be deleted in 14 days",
      paragraphs: [
        `Hi ${me.name},`,
        `We've received your request to delete your account. Your listings are hidden now, and your account will be permanently deleted on ${scheduledFor.toLocaleDateString("en-GB")}.`,
        "Changed your mind? Log in and cancel the deletion from Settings → Your data before then.",
        "We keep some records after deletion where the law requires it – for example order and tax records.",
      ],
    });
    revalidatePath("/settings/data");
    return { ok: true, message: `Your account will be deleted on ${scheduledFor.toLocaleDateString("en-GB")}. You can cancel any time before then.` };
  },
);

export async function cancelDeletionAction() {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await db.deletionRequest.updateMany({ where: { userId: me.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    revalidatePath("/settings/data");
  });
}

export async function savePushSubscriptionAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const parsed = z
      .object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) })
      .parse(sub);
    await db.pushSubscription.upsert({
      where: { endpoint: parsed.endpoint },
      create: { userId: me.id, endpoint: parsed.endpoint, p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
      update: { userId: me.id, p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
    });
  });
}
