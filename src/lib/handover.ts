import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** 6-digit in-person handover code derived from the order id (nothing stored in plain text). */
export function handoverCode(orderId: string): string {
  const mac = createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "dev-secret").update(`handover:${orderId}`).digest();
  return String(mac.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function verifyHandoverCode(orderId: string, code: string): boolean {
  const a = Buffer.from(handoverCode(orderId));
  const b = Buffer.from(code.replace(/\D/g, "").padStart(6, "0").slice(0, 6));
  return a.length === b.length && timingSafeEqual(a, b);
}
