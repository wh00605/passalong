import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

/** Balances are derived from the append-only ledger – never stored. */
export async function getBalances(userId: string, tx: Tx = db) {
  const rows = await tx.ledgerEntry.groupBy({ by: ["bucket"], where: { userId }, _sum: { amountPence: true } });
  const sum = (b: "PENDING" | "AVAILABLE") => rows.find((r) => r.bucket === b)?._sum.amountPence ?? 0;
  return { pendingPence: sum("PENDING"), availablePence: sum("AVAILABLE") };
}

/** Seller earnings credited when an order is paid (held as pending). */
export async function creditSale(tx: Tx, order: { id: string; number: string; sellerId: string; sellerEarningsPence: number }) {
  await tx.ledgerEntry.create({
    data: { userId: order.sellerId, orderId: order.id, type: "SALE", bucket: "PENDING", amountPence: order.sellerEarningsPence, description: `Sale ${order.number} (held until completed)` },
  });
}

/** Moves an order's remaining pending earnings to available. */
export async function releaseSale(tx: Tx, order: { id: string; number: string; sellerId: string }) {
  const pending = await tx.ledgerEntry.aggregate({ where: { orderId: order.id, userId: order.sellerId, bucket: "PENDING" }, _sum: { amountPence: true } });
  const amount = pending._sum.amountPence ?? 0;
  if (amount <= 0) return 0;
  await tx.ledgerEntry.createMany({
    data: [
      { userId: order.sellerId, orderId: order.id, type: "RELEASE", bucket: "PENDING", amountPence: -amount, description: `Sale ${order.number} completed` },
      { userId: order.sellerId, orderId: order.id, type: "RELEASE", bucket: "AVAILABLE", amountPence: amount, description: `Sale ${order.number} completed` },
    ],
  });
  return amount;
}

/**
 * Takes a refund out of the seller's held earnings for an order (before release).
 * Returns how much was deducted (never more than is still pending for this order).
 */
export async function debitRefund(tx: Tx, order: { id: string; number: string; sellerId: string }, amountPence: number) {
  const pending = await tx.ledgerEntry.aggregate({ where: { orderId: order.id, userId: order.sellerId, bucket: "PENDING" }, _sum: { amountPence: true } });
  const deduct = Math.min(amountPence, pending._sum.amountPence ?? 0);
  if (deduct > 0) {
    await tx.ledgerEntry.create({
      data: { userId: order.sellerId, orderId: order.id, type: "REFUND", bucket: "PENDING", amountPence: -deduct, description: `Refund on ${order.number}` },
    });
  }
  return deduct;
}
