import "server-only";
import { db } from "@/lib/db";

export type DayPoint = { day: string; value: number };

async function daily(sql: Promise<{ day: Date; value: bigint | number | null }[]>, days: number): Promise<DayPoint[]> {
  const rows = await sql;
  const map = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.value ?? 0)]));
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day: d, value: map.get(d) ?? 0 });
  }
  return out;
}

/** Basic marketplace KPIs for the admin dashboard. GMV = item value of paid orders (excl. postage & fees). */
export async function getAnalytics(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const paid = ["PAID", "SHIPPED", "DELIVERED", "COMPLETED", "DISPUTED", "REFUNDED"];
  const [signups, listings, orders, gmv, fees, promoRevenue, totals] = await Promise.all([
    daily(db.$queryRaw`SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "user" WHERE "createdAt" >= ${since} GROUP BY 1`, days),
    daily(db.$queryRaw`SELECT date_trunc('day', "publishedAt") AS day, COUNT(*) AS value FROM "Listing" WHERE "publishedAt" >= ${since} GROUP BY 1`, days),
    daily(db.$queryRaw`SELECT date_trunc('day', "paidAt") AS day, COUNT(*) AS value FROM "Order" WHERE "paidAt" >= ${since} GROUP BY 1`, days),
    daily(db.$queryRaw`SELECT date_trunc('day', "paidAt") AS day, SUM("itemsSubtotalPence" - "bundleDiscountPence") AS value FROM "Order" WHERE "paidAt" >= ${since} GROUP BY 1`, days),
    daily(db.$queryRaw`SELECT date_trunc('day', "paidAt") AS day, SUM("buyerProtectionFeePence" + ("itemsSubtotalPence" - "bundleDiscountPence" - "sellerEarningsPence")) AS value FROM "Order" WHERE "paidAt" >= ${since} AND "status" <> 'REFUNDED' GROUP BY 1`, days),
    daily(db.$queryRaw`SELECT date_trunc('day', "startsAt") AS day, SUM("pricePence") AS value FROM "Promotion" WHERE "startsAt" >= ${since} AND "status" IN ('ACTIVE','EXPIRED') GROUP BY 1`, days),
    Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.listing.count({ where: { status: "ACTIVE" } }),
      db.order.count({ where: { status: { in: paid as never } } }),
      db.dispute.count({ where: { status: { in: ["AWAITING_SELLER", "AWAITING_BUYER", "ESCALATED", "RETURN_REQUESTED", "RETURN_IN_TRANSIT"] } } }),
      db.report.count({ where: { status: "OPEN" } }),
      db.listing.count({ where: { moderationStatus: "PENDING_REVIEW", status: { not: "DELETED" } } }),
      db.fraudSignal.count({ where: { resolvedAt: null } }),
      db.illegalContentNotice.count({ where: { status: { in: ["RECEIVED", "UNDER_REVIEW"] } } }),
    ]),
  ]);
  const sum = (s: DayPoint[]) => s.reduce((a, p) => a + p.value, 0);
  const [members, liveListings, totalOrders, openDisputes, openReports, pendingListings, openSignals, openNotices] = totals;
  return {
    series: { signups, listings, orders, gmv, fees, promoRevenue },
    period: { signups: sum(signups), listings: sum(listings), orders: sum(orders), gmvPence: sum(gmv), feePence: sum(fees) + sum(promoRevenue) },
    totals: { members, liveListings, totalOrders },
    queues: { openDisputes, openReports, pendingListings, openSignals, openNotices },
  };
}
