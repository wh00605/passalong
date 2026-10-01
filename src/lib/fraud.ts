import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Prisma } from "@/generated/prisma/client";

export type FraudType = "NEW_ACCOUNT_HIGH_VALUE" | "MANY_REPORTS" | "PAYMENT_FAILURES" | "OFF_PLATFORM" | "SPAM";

/** Records a fraud signal unless an unresolved one of the same type already exists for the member. */
export async function raiseSignal(userId: string, type: FraudType, score: number, details: Prisma.InputJsonValue) {
  const open = await db.fraudSignal.findFirst({ where: { userId, type, resolvedAt: null }, select: { id: true } });
  if (open) {
    await db.fraudSignal.update({ where: { id: open.id }, data: { score: { increment: Math.ceil(score / 2) }, details } });
    return;
  }
  await db.fraudSignal.create({ data: { userId, type, score, details } });
}

/** 3+ distinct reporters in 30 days → signal for review. */
export async function evaluateReportSignals(userId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const reporters = await db.report.findMany({
    where: { createdAt: { gte: since }, OR: [{ userId }, { listing: { sellerId: userId } }] },
    distinct: ["reporterId"],
    select: { reporterId: true },
  });
  if (reporters.length >= 3) await raiseSignal(userId, "MANY_REPORTS", 10 * reporters.length, { distinctReporters: reporters.length });
}

/** New account listing expensive items is a common scam pattern. */
export async function evaluateNewAccountListing(userId: string, pricePence: number) {
  const s = await getSettings();
  const user = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return false;
  const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
  if (ageDays < s.newAccountDays && pricePence >= s.newAccountHighValuePence) {
    await raiseSignal(userId, "NEW_ACCOUNT_HIGH_VALUE", 30, { pricePence, accountAgeDays: Math.round(ageDays * 10) / 10 });
    return true;
  }
  return false;
}

/** 3+ failed payments in 24h. */
export async function recordPaymentFailure(userId: string, reason: string) {
  const since = new Date(Date.now() - 86_400_000);
  const recent = await db.fraudSignal.findFirst({ where: { userId, type: "PAYMENT_FAILURES", resolvedAt: null, createdAt: { gte: since } } });
  const failures = ((recent?.details as { failures?: number } | null)?.failures ?? 0) + 1;
  if (recent) {
    await db.fraudSignal.update({ where: { id: recent.id }, data: { details: { failures, lastReason: reason }, score: 10 * failures } });
  } else {
    await db.fraudSignal.create({ data: { userId, type: "PAYMENT_FAILURES", score: 10, details: { failures, lastReason: reason } } });
  }
}

// ── Off-platform payment detection for chat ──────────────────────────────────

const OFF_PLATFORM_PATTERNS: RegExp[] = [
  /\bpay\s*pal\b/i,
  /\bbank\s*transfer\b/i,
  /\b(sort\s*code|account\s*number|iban)\b/i,
  /\b\d{2}[-\s]?\d{2}[-\s]?\d{2}\b.*\b\d{8}\b/, // sort code + account number
  /\b(whats\s*app|telegram|signal app|wechat)\b/i,
  /\b(revolut|monzo|cash\s*app|venmo|zelle|western\s*union|crypto|bitcoin|usdt)\b/i,
  /\b(friends\s*(and|&)\s*family)\b/i,
  /\bpay\s*(me\s*)?(direct(ly)?|outside|off\s*(the\s*)?(app|site|platform))\b/i,
  /\b(e-?mail|text|call)\s*me\b/i,
  /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/, // UK mobile numbers
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // email addresses
];

/** Returns true if a chat message looks like an attempt to move payment or contact off the platform. */
export function looksOffPlatform(text: string): boolean {
  return OFF_PLATFORM_PATTERNS.some((re) => re.test(text));
}

const SUSPICIOUS_LINK = /\bhttps?:\/\/(?!([a-z0-9-]+\.)?passalong\.co\.uk)[^\s]+/i;

export function containsExternalLink(text: string): boolean {
  return SUSPICIOUS_LINK.test(text);
}
