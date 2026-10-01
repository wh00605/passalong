"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validatedAction } from "@/lib/action";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

export const illegalContentAction = validatedAction(
  z.object({
    contentUrl: z.url("Enter the full link (starting https://).").max(500),
    legalBasis: z.string().trim().min(3, "Tell us which law applies.").max(300),
    explanation: z.string().trim().min(20, "Please explain in a little more detail.").max(4000),
    reporterName: z.string().trim().min(2, "Enter your name.").max(100),
    reporterEmail: z.email("Enter a valid email.").max(254),
    goodFaith: z.literal("on", { error: "Please confirm the statement." }),
  }),
  async (d) => {
    await enforceRateLimit("illegal-notice", await clientIp(), 10, 3600);
    const n = await db.illegalContentNotice.create({
      data: { contentUrl: d.contentUrl, legalBasis: d.legalBasis, explanation: d.explanation, reporterName: d.reporterName, reporterEmail: d.reporterEmail, goodFaith: true },
    });
    // Acknowledge receipt without undue delay (DSA Art. 16(4)).
    await sendEmail({
      to: d.reporterEmail,
      subject: "We've received your notice",
      paragraphs: [`Hi ${d.reporterName},`, `Thanks for your notice about ${d.contentUrl}. We'll review it and email you our decision.`, `Reference: ${n.id.slice(-8).toUpperCase()}`],
    });
    return { ok: true, message: `Thanks – your notice has been received (reference ${n.id.slice(-8).toUpperCase()}). We'll email you our decision.` };
  },
);
