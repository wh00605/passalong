import "server-only";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { listingPath } from "@/lib/slug";
import type { ModerationActionType } from "@/generated/prisma/enums";

/**
 * Moderation decisions. Each one records a ModerationAction, writes the audit log, and sends the
 * affected member a statement of reasons (EU DSA Art. 17 / UK Online Safety Act good practice).
 */
async function record(input: { moderatorId: string; action: ModerationActionType; targetType: string; targetId: string; userId?: string | null; reason: string; reportId?: string; expiresAt?: Date }) {
  await db.moderationAction.create({ data: { ...input, userId: input.userId ?? null } });
  await audit(input.moderatorId, `moderation.${input.action.toLowerCase()}`, input.targetType, input.targetId, { reason: input.reason, reportId: input.reportId ?? null, expiresAt: input.expiresAt?.toISOString() ?? null });
}

async function statementOfReasons(userId: string, title: string, body: string, url?: string) {
  await notify({
    userId,
    type: "ACCOUNT",
    title,
    body,
    url: url ?? "/help/staying-safe",
    forceEmail: true,
    emailParagraphs: [
      body,
      "This decision was made by our moderation team under our Terms of service and catalogue rules.",
      "If you think we got this wrong, reply via the contact form (choose “Appeal a decision”) within 6 months and a different team member will review it.",
    ],
  });
}

export async function approveListing(moderatorId: string, listingId: string) {
  const l = await db.listing.update({ where: { id: listingId }, data: { moderationStatus: "OK", moderationNote: null } });
  await record({ moderatorId, action: "APPROVE", targetType: "listing", targetId: listingId, userId: l.sellerId, reason: "Approved after review" });
  await notify({ userId: l.sellerId, type: "ACCOUNT", title: "Your item is live", body: `“${l.title}” passed review and is now visible to buyers.`, url: listingPath(l) });
}

export async function removeListing(moderatorId: string, listingId: string, reason: string, reportId?: string) {
  const l = await db.listing.findUniqueOrThrow({ where: { id: listingId } });
  const inOrder = await db.orderItem.count({ where: { listingId, order: { status: { in: ["PAID", "SHIPPED", "DELIVERED", "DISPUTED"] } } } });
  if (inOrder) throw new ActionError("This item is in an active order – resolve the order first.");
  await db.listing.update({ where: { id: listingId }, data: { moderationStatus: "REMOVED", status: "REMOVED", moderationNote: reason } });
  await record({ moderatorId, action: "REMOVE", targetType: "listing", targetId: listingId, userId: l.sellerId, reason, reportId });
  await statementOfReasons(l.sellerId, "We removed one of your items", `We removed “${l.title}” because: ${reason}`);
}

export async function restoreListing(moderatorId: string, listingId: string, reason: string) {
  const l = await db.listing.update({ where: { id: listingId }, data: { moderationStatus: "OK", status: "HIDDEN", moderationNote: null } });
  await record({ moderatorId, action: "RESTORE", targetType: "listing", targetId: listingId, userId: l.sellerId, reason });
  await notify({ userId: l.sellerId, type: "ACCOUNT", title: "Your item was restored", body: `“${l.title}” has been restored and is hidden – unhide it when you're ready.`, url: listingPath(l) });
}

export async function warnUser(moderatorId: string, userId: string, reason: string, reportId?: string) {
  await db.user.update({ where: { id: userId }, data: { warningCount: { increment: 1 } } });
  await record({ moderatorId, action: "WARN", targetType: "user", targetId: userId, userId, reason, reportId });
  await statementOfReasons(userId, "A warning about your account", `You've received a warning: ${reason}. Repeated problems can lead to your account being suspended.`);
}

/** Suspension = temporary ban (Better Auth enforces it at sign-in; we revoke current sessions). */
export async function suspendUser(moderatorId: string, userId: string, days: number, reason: string, reportId?: string) {
  if (days < 1 || days > 365) throw new ActionError("Suspensions are 1–365 days.");
  const until = new Date(Date.now() + days * 86_400_000);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { banned: true, banReason: reason, banExpires: until, suspendedUntil: until, holidayMode: true } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
  await record({ moderatorId, action: "SUSPEND", targetType: "user", targetId: userId, userId, reason, reportId, expiresAt: until });
  await statementOfReasons(userId, "Your account has been suspended", `Your account is suspended until ${until.toLocaleDateString("en-GB")} because: ${reason}. Your items are hidden in the meantime.`);
}

export async function banUser(moderatorId: string, userId: string, reason: string, reportId?: string) {
  const open = await db.order.count({ where: { sellerId: userId, status: { in: ["PAID", "SHIPPED", "DELIVERED", "DISPUTED"] } } });
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { banned: true, banReason: reason, banExpires: null, holidayMode: true } }),
    db.session.deleteMany({ where: { userId } }),
    db.listing.updateMany({ where: { sellerId: userId, status: { in: ["ACTIVE", "RESERVED", "DRAFT"] } }, data: { status: "HIDDEN" } }),
  ]);
  await record({ moderatorId, action: "BAN", targetType: "user", targetId: userId, userId, reason, reportId });
  await statementOfReasons(userId, "Your account has been closed", `Your account has been permanently closed because: ${reason}.${open ? " Orders already in progress will still be handled by our support team." : ""}`);
}

export async function unbanUser(moderatorId: string, userId: string, reason: string) {
  await db.user.update({ where: { id: userId }, data: { banned: false, banReason: null, banExpires: null, suspendedUntil: null } });
  await record({ moderatorId, action: "UNBAN", targetType: "user", targetId: userId, userId, reason });
  await notify({ userId, type: "ACCOUNT", title: "Your account has been restored", body: "You can log in and use Passalong again. Turn off holiday mode to show your items.", forceEmail: true });
}

export async function resolveReport(moderatorId: string, reportId: string, outcome: "ACTIONED" | "DISMISSED") {
  const r = await db.report.update({ where: { id: reportId }, data: { status: outcome, handledById: moderatorId, handledAt: new Date() } });
  if (outcome === "DISMISSED") await record({ moderatorId, action: "DISMISS", targetType: "report", targetId: reportId, userId: r.userId, reason: "No breach found" });
  // Tell the reporter the outcome (DSA Art. 16(5)).
  await notify({
    userId: r.reporterId,
    type: "ACCOUNT",
    title: "Update on your report",
    body: outcome === "ACTIONED" ? "Thanks – we reviewed your report and took action." : "Thanks – we reviewed your report and didn't find a breach of our rules this time.",
  });
}

export async function hideMessage(moderatorId: string, messageId: string, reason: string) {
  const m = await db.message.update({ where: { id: messageId }, data: { hiddenAt: new Date(), body: "This message was removed by Passalong." } });
  await record({ moderatorId, action: "REMOVE", targetType: "message", targetId: messageId, userId: m.senderId, reason });
}
