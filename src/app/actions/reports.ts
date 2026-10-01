"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validatedAction } from "@/lib/action";
import { requireUserForAction, ActionError } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { evaluateReportSignals } from "@/lib/fraud";

export const createReportAction = validatedAction(
  z.object({
    targetType: z.enum(["LISTING", "USER", "MESSAGE"]),
    targetId: z.string().min(1).max(64),
    reason: z.string().min(1, "Choose a reason.").max(40),
    details: z.string().trim().max(1000).optional().default(""),
  }),
  async (data) => {
    const me = await requireUserForAction();
    await enforceRateLimit("report", me.id, 20, 3600);
    const valid = (REPORT_REASONS[data.targetType] as readonly (readonly [string, string])[]).some(([v]) => v === data.reason);
    if (!valid) throw new ActionError("Choose a reason.");

    let reportedUserId: string | null = null;
    const link: { listingId?: string; userId?: string; messageId?: string } = {};
    if (data.targetType === "LISTING") {
      const l = await db.listing.findUnique({ where: { id: data.targetId }, select: { id: true, sellerId: true } });
      if (!l) throw new ActionError("That item no longer exists.");
      link.listingId = l.id;
      reportedUserId = l.sellerId;
    } else if (data.targetType === "USER") {
      const u = await db.user.findUnique({ where: { id: data.targetId }, select: { id: true } });
      if (!u) throw new ActionError("That member no longer exists.");
      link.userId = u.id;
      reportedUserId = u.id;
    } else {
      const m = await db.message.findUnique({
        where: { id: data.targetId },
        select: { id: true, senderId: true, conversation: { select: { buyerId: true, sellerId: true } } },
      });
      // Only participants of the conversation may report a message.
      if (!m || (m.conversation.buyerId !== me.id && m.conversation.sellerId !== me.id)) throw new ActionError("That message no longer exists.");
      link.messageId = m.id;
      reportedUserId = m.senderId;
    }
    if (reportedUserId === me.id) throw new ActionError("You can't report yourself.");

    const duplicate = await db.report.findFirst({
      where: { reporterId: me.id, targetType: data.targetType, ...link, status: "OPEN" },
      select: { id: true },
    });
    if (!duplicate) {
      await db.report.create({
        data: {
          reporterId: me.id,
          targetType: data.targetType,
          reason: data.reason,
          details: data.details,
          ...link,
          userId: link.userId ?? reportedUserId ?? undefined,
        },
      });
      if (reportedUserId) await evaluateReportSignals(reportedUserId);
    }
    return { ok: true, message: "Thanks – our team will review your report. We may contact you if we need more information." };
  },
);
