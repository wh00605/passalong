"use server";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { safeAction, validatedAction } from "@/lib/action";
import { getCurrentUser, isStaff } from "@/lib/session";
import { ActionError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parsePounds } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import * as enforce from "@/lib/enforcement";
import { refundOrder, cancelOrder, completeOrder } from "@/lib/orders";
import { staffResolve } from "@/lib/disputes";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

async function staff() {
  const u = await getCurrentUser();
  if (!u || !isStaff(u)) throw new ActionError("Not allowed.");
  return u;
}
async function admin() {
  const u = await staff();
  if (u.role !== "admin") throw new ActionError("Only admins can do this.");
  return u;
}
const id = z.string().min(1).max(64);
const reason = z.string().trim().min(3, "Give a reason (it's sent to the member).").max(500);

// ── Moderation ───────────────────────────────────────────────────────────────

export async function moderateListingAction(listingId: string, op: "approve" | "remove" | "restore", reportId: string | undefined, why = "") {
  return safeAction(async () => {
    const me = await staff();
    if (op === "approve") await enforce.approveListing(me.id, id.parse(listingId));
    else if (op === "remove") await enforce.removeListing(me.id, id.parse(listingId), reason.parse(why), reportId);
    else await enforce.restoreListing(me.id, id.parse(listingId), reason.parse(why));
    if (reportId) await enforce.resolveReport(me.id, reportId, "ACTIONED");
    revalidatePath("/admin", "layout");
  });
}

export async function moderateUserAction(userId: string, op: "warn" | "suspend" | "ban" | "unban", reportId: string | undefined, why: string, days?: number) {
  return safeAction(async () => {
    const me = op === "ban" || op === "unban" ? await admin() : await staff();
    const uid = z.uuid().parse(userId);
    if (uid === me.id) throw new ActionError("You can't moderate yourself.");
    const target = await db.user.findUniqueOrThrow({ where: { id: uid }, select: { role: true } });
    if (target.role !== "user" && me.role !== "admin") throw new ActionError("Only admins can act on staff accounts.");
    const r = reason.parse(why);
    if (op === "warn") await enforce.warnUser(me.id, uid, r, reportId);
    else if (op === "suspend") await enforce.suspendUser(me.id, uid, z.number().int().min(1).max(365).parse(days), r, reportId);
    else if (op === "ban") await enforce.banUser(me.id, uid, r, reportId);
    else await enforce.unbanUser(me.id, uid, r);
    if (reportId) await enforce.resolveReport(me.id, reportId, "ACTIONED");
    revalidatePath("/admin", "layout");
  });
}

export async function dismissReportAction(reportId: string) {
  return safeAction(async () => {
    const me = await staff();
    await enforce.resolveReport(me.id, id.parse(reportId), "DISMISSED");
    revalidatePath("/admin", "layout");
  });
}

export async function hideMessageAction(messageId: string, reportId: string | undefined, why: string) {
  return safeAction(async () => {
    const me = await staff();
    await enforce.hideMessage(me.id, id.parse(messageId), reason.parse(why));
    if (reportId) await enforce.resolveReport(me.id, reportId, "ACTIONED");
    revalidatePath("/admin", "layout");
  });
}

export async function resolveFraudSignalAction(signalId: string) {
  return safeAction(async () => {
    const me = await staff();
    await db.fraudSignal.update({ where: { id: id.parse(signalId) }, data: { resolvedAt: new Date() } });
    await audit(me.id, "fraud.resolve", "fraudSignal", signalId);
    revalidatePath("/admin", "layout");
  });
}

export async function decideNoticeAction(noticeId: string, decision: "ACTIONED" | "REJECTED", why: string) {
  return safeAction(async () => {
    const me = await staff();
    const r = reason.parse(why);
    const n = await db.illegalContentNotice.update({
      where: { id: id.parse(noticeId) },
      data: { status: decision, decision: decision === "ACTIONED" ? "Content restricted" : "No action", decisionReason: r, decidedById: me.id, decidedAt: new Date() },
    });
    await audit(me.id, `notice.${decision.toLowerCase()}`, "illegalContentNotice", n.id, { reason: r });
    // Notify the notifier of the decision (DSA Art. 16(5)).
    await sendEmail({
      to: n.reporterEmail,
      subject: "Decision on your illegal content notice",
      paragraphs: [
        `Hi ${n.reporterName},`,
        `We've reviewed the notice you submitted about ${n.contentUrl}.`,
        decision === "ACTIONED" ? `We have restricted the content. Reason: ${r}` : `We decided not to take action. Reason: ${r}`,
        "You can contact us if you'd like to challenge this decision.",
      ],
    });
    revalidatePath("/admin/notices");
  });
}

// ── Orders, refunds, disputes ────────────────────────────────────────────────

export async function adminRefundAction(orderId: string, amount: string, why: string) {
  return safeAction(async () => {
    const me = await admin();
    const pence = parsePounds(amount);
    if (pence == null) throw new ActionError("Enter an amount like 12.50.");
    await refundOrder({ orderId: id.parse(orderId), amountPence: pence, reason: `Support: ${reason.parse(why)}`, initiatedById: me.id });
    await audit(me.id, "order.refund", "order", orderId, { amountPence: pence, reason: why });
    revalidatePath(`/admin/orders/${orderId}`);
  });
}

export async function adminCancelOrderAction(orderId: string, why: string) {
  return safeAction(async () => {
    const me = await admin();
    await cancelOrder({ orderId: id.parse(orderId), byUserId: me.id, reason: reason.parse(why), asStaff: true });
    await audit(me.id, "order.cancel", "order", orderId, { reason: why });
    revalidatePath(`/admin/orders/${orderId}`);
  });
}

export async function adminReleaseFundsAction(orderId: string, why: string) {
  return safeAction(async () => {
    const me = await admin();
    await completeOrder(id.parse(orderId), "support");
    await audit(me.id, "order.release", "order", orderId, { reason: reason.parse(why) });
    revalidatePath(`/admin/orders/${orderId}`);
  });
}

export async function resolveDisputeAction(disputeId: string, kind: "refund" | "partial" | "release", amount: string, note: string) {
  return safeAction(async () => {
    const me = await staff();
    const n = reason.parse(note);
    if (kind === "partial") {
      const pence = parsePounds(amount);
      if (pence == null) throw new ActionError("Enter the partial refund amount.");
      await staffResolve(id.parse(disputeId), me.id, { kind, amountPence: pence }, n);
    } else {
      await staffResolve(id.parse(disputeId), me.id, { kind }, n);
    }
    await audit(me.id, `dispute.${kind}`, "dispute", disputeId, { note: n, amount });
    revalidatePath("/admin/disputes");
  });
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function setRoleAction(userId: string, role: "user" | "moderator" | "admin") {
  return safeAction(async () => {
    const me = await admin();
    const uid = z.uuid().parse(userId);
    if (uid === me.id) throw new ActionError("You can't change your own role.");
    await db.user.update({ where: { id: uid }, data: { role: z.enum(["user", "moderator", "admin"]).parse(role) } });
    await audit(me.id, "user.role", "user", uid, { role });
    revalidatePath(`/admin/users/${uid}`);
  });
}

// ── Settings: fees, prices, policies ─────────────────────────────────────────

export const saveSettingsAction = validatedAction(z.object({}).passthrough(), async (_d, form) => {
  const me = await admin();
  const changes: Record<string, { from: unknown; to: number }> = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const raw = form.get(key);
    if (raw == null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new ActionError(`${key} must be a whole number.`);
    const current = await db.platformSetting.findUnique({ where: { key } });
    const from = current?.value ?? def;
    if (from !== n) {
      await db.platformSetting.upsert({ where: { key }, create: { key, value: n, updatedById: me.id }, update: { value: n, updatedById: me.id } });
      changes[key] = { from, to: n };
    }
  }
  if (Object.keys(changes).length) await audit(me.id, "settings.update", "platformSetting", null, changes as never);
  revalidatePath("/", "layout");
  return { ok: true, message: Object.keys(changes).length ? `Saved ${Object.keys(changes).length} change(s).` : "No changes." };
});

// ── Catalogue ────────────────────────────────────────────────────────────────

export const addBrandAction = validatedAction(z.object({ name: z.string().trim().min(1).max(60) }), async (d) => {
  const me = await admin();
  const b = await db.brand.upsert({ where: { name: d.name }, create: { name: d.name, slug: slugify(d.name) }, update: { isActive: true } });
  await audit(me.id, "brand.add", "brand", b.id, { name: d.name });
  revalidateTag("catalogue", "max");
  return { ok: true, message: `Added ${d.name}.` };
});

export async function toggleBrandAction(brandId: string, active: boolean) {
  return safeAction(async () => {
    const me = await admin();
    await db.brand.update({ where: { id: id.parse(brandId) }, data: { isActive: active } });
    await audit(me.id, active ? "brand.enable" : "brand.disable", "brand", brandId);
    revalidateTag("catalogue", "max");
    revalidatePath("/admin/catalogue");
  });
}

export const addCategoryAction = validatedAction(
  z.object({ parentId: z.string().max(40).optional(), name: z.string().trim().min(2).max(60), sizeGroupId: z.string().max(40).optional() }),
  async (d) => {
    const me = await admin();
    const parent = d.parentId ? await db.category.findUnique({ where: { id: d.parentId } }) : null;
    const slug = slugify(d.name);
    const c = await db.category.create({
      data: { name: d.name, slug, path: parent ? `${parent.path}/${slug}` : slug, parentId: parent?.id, sizeGroupId: d.sizeGroupId || parent?.sizeGroupId || null },
    });
    await audit(me.id, "category.add", "category", c.id, { path: c.path });
    revalidateTag("catalogue", "max");
    return { ok: true, message: `Added ${c.path}.` };
  },
);

export async function updateCategoryAction(categoryId: string, patch: { isActive?: boolean; isProhibited?: boolean }) {
  return safeAction(async () => {
    const me = await admin();
    await db.category.update({ where: { id: id.parse(categoryId) }, data: z.object({ isActive: z.boolean().optional(), isProhibited: z.boolean().optional() }).parse(patch) });
    await audit(me.id, "category.update", "category", categoryId, patch);
    revalidateTag("catalogue", "max");
    revalidatePath("/admin/catalogue");
  });
}

export const addSizeAction = validatedAction(z.object({ groupId: id, label: z.string().trim().min(1).max(30) }), async (d) => {
  const me = await admin();
  const count = await db.size.count({ where: { groupId: d.groupId } });
  await db.size.create({ data: { groupId: d.groupId, label: d.label, position: count } });
  await audit(me.id, "size.add", "sizeGroup", d.groupId, { label: d.label });
  revalidateTag("catalogue", "max");
  return { ok: true, message: `Added size ${d.label}.` };
});

export const saveParcelAction = validatedAction(z.object({ id, price: z.string() }), async (d) => {
  const me = await admin();
  const pence = parsePounds(d.price);
  if (pence == null) throw new ActionError("Enter a price.");
  await db.parcelSize.update({ where: { id: d.id }, data: { pricePence: pence } });
  await audit(me.id, "parcel.price", "parcelSize", d.id, { pricePence: pence });
  revalidateTag("catalogue", "max");
  return { ok: true, message: "Parcel price saved." };
});

export const addProhibitedTermAction = validatedAction(z.object({ term: z.string().trim().toLowerCase().min(2).max(60), severity: z.enum(["BLOCK", "REVIEW"]), note: z.string().trim().max(200).optional() }), async (d) => {
  const me = await staff();
  await db.prohibitedTerm.upsert({ where: { term: d.term }, create: d, update: { severity: d.severity, note: d.note } });
  await audit(me.id, "prohibited.add", "prohibitedTerm", d.term, d);
  revalidateTag("prohibited-terms", "max");
  return { ok: true, message: `Saved “${d.term}”.` };
});

export async function deleteProhibitedTermAction(termId: string) {
  return safeAction(async () => {
    const me = await staff();
    const t = await db.prohibitedTerm.delete({ where: { id: id.parse(termId) } });
    await audit(me.id, "prohibited.delete", "prohibitedTerm", t.term);
    revalidateTag("prohibited-terms", "max");
    revalidatePath("/admin/catalogue");
  });
}

// ── Help & support ──────────────────────────────────────────────────────────

export const saveHelpArticleAction = validatedAction(
  z.object({ id: z.string().optional(), title: z.string().trim().min(3).max(120), category: z.string().trim().min(2).max(40), body: z.string().trim().min(10).max(20000), published: z.preprocess((v) => v === "on", z.boolean()) }),
  async (d) => {
    const me = await admin();
    const data = { title: d.title, category: d.category, body: d.body, published: d.published };
    const a = d.id ? await db.helpArticle.update({ where: { id: d.id }, data }) : await db.helpArticle.create({ data: { ...data, slug: slugify(d.title) } });
    await audit(me.id, d.id ? "help.update" : "help.create", "helpArticle", a.id);
    revalidatePath("/help", "layout");
    return { ok: true, message: "Article saved." };
  },
);

export async function closeTicketAction(ticketId: string) {
  return safeAction(async () => {
    const me = await staff();
    await db.contactTicket.update({ where: { id: id.parse(ticketId) }, data: { status: "CLOSED" } });
    await audit(me.id, "ticket.close", "contactTicket", ticketId);
    revalidatePath("/admin/tickets");
  });
}

export async function messageUserAction(userId: string, title: string, body: string) {
  return safeAction(async () => {
    const me = await staff();
    await notify({ userId: z.uuid().parse(userId), type: "ACCOUNT", title: z.string().min(3).max(120).parse(title), body: z.string().min(3).max(2000).parse(body), forceEmail: true });
    await audit(me.id, "user.message", "user", userId, { title });
  });
}
