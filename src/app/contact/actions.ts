"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validatedAction } from "@/lib/action";
import { getCurrentUser } from "@/lib/session";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

export const contactAction = validatedAction(
  z.object({
    name: z.string().trim().min(2, "Enter your name.").max(80),
    email: z.email("Enter a valid email.").max(254),
    topic: z.string().max(60),
    orderNumber: z.string().trim().max(20).optional(),
    message: z.string().trim().min(10, "Tell us a bit more (at least 10 characters).").max(4000),
    website: z.string().max(0, "Spam check failed.").optional(), // honeypot
  }),
  async (d) => {
    await enforceRateLimit("contact", await clientIp(), 5, 3600);
    const user = await getCurrentUser();
    const t = await db.contactTicket.create({ data: { userId: user?.id, name: d.name, email: d.email, topic: d.topic, orderNumber: d.orderNumber || null, message: d.message } });
    await sendEmail({
      to: process.env.SUPPORT_EMAIL ?? "support@passalong.co.uk",
      subject: `[Support] ${d.topic} – ${d.name}`,
      paragraphs: [`From: ${d.name} <${d.email}>${user ? ` (@${user.username})` : ""}`, `Order: ${d.orderNumber || "–"}`, d.message, `Ticket ${t.id}`],
    });
    await sendEmail({ to: d.email, subject: "We've got your message", paragraphs: [`Hi ${d.name},`, "Thanks for getting in touch. We'll reply within 2 working days.", `Your reference: ${t.id.slice(-8).toUpperCase()}`] });
    return { ok: true, message: "Thanks – we've got your message and will reply within 2 working days." };
  },
);
