import "server-only";
import { Resend } from "resend";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { integrations, isProduction, siteUrl } from "@/lib/env";

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain paragraphs; rendered into a simple accessible HTML template. */
  paragraphs: string[];
  action?: { label: string; url: string };
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderEmail(msg: EmailMessage): { html: string; text: string } {
  const body = msg.paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(p)}</p>`).join("");
  const button = msg.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(msg.action.url)}" style="background:#2e2862;color:#ffffff;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(msg.action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#555">If the button doesn't work, copy this link: ${escapeHtml(msg.action.url)}</p>`
    : "";
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${escapeHtml(msg.subject)}</title></head>
<body style="margin:0;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#1c1a24">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-family:Georgia,serif;font-size:26px;color:#2e2862;margin:0 0 28px">Passalong</p>
${body}${button}
<hr style="border:none;border-top:1px solid #e5e1da;margin:32px 0 16px">
<p style="font-size:12px;color:#666;margin:0">You can change which emails you receive in <a href="${siteUrl}/settings/notifications">notification settings</a>.</p>
</div></body></html>`;
  const text = [...msg.paragraphs, msg.action ? `${msg.action.label}: ${msg.action.url}` : ""].filter(Boolean).join("\n\n");
  return { html, text };
}

let resend: Resend | null = null;

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const { html, text } = renderEmail(msg);

  if (integrations.resend()) {
    resend ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Passalong <hello@passalong.co.uk>",
      to: msg.to,
      subject: msg.subject,
      html,
      text,
    });
    if (error) throw new Error(`Email send failed: ${error.message}`);
    return;
  }

  if (isProduction && process.env.ALLOW_DEV_EMAIL !== "true") {
    // TODO(keys): set RESEND_API_KEY. We refuse to silently drop mail in production.
    console.error(`[email] RESEND_API_KEY not configured – could not send "${msg.subject}" to ${msg.to}`);
    return;
  }

  // Development / test: write to ./.emails so developers and e2e tests can open links.
  const dir = path.resolve(".emails");
  await mkdir(dir, { recursive: true });
  const safeTo = msg.to.replace(/[^a-z0-9@._-]/gi, "_");
  const file = path.join(dir, `${Date.now()}-${safeTo}.json`);
  await writeFile(file, JSON.stringify({ ...msg, text }, null, 2));
  console.info(`[email:dev] To ${msg.to}: ${msg.subject}${msg.action ? ` → ${msg.action.url}` : ""}`);
}
