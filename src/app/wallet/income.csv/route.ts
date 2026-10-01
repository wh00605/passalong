import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Seller's own income record for a calendar year (CSV), for their records and Self Assessment. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  const orders = await db.order.findMany({
    where: { sellerId: user.id, status: { in: ["COMPLETED", "REFUNDED"] }, paidAt: { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${year + 1}-01-01T00:00:00Z`) } },
    orderBy: { paidAt: "asc" },
    include: { items: { select: { title: true } } },
  });
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    ["Order", "Date paid", "Items", "Status", "Earnings (£)", "Refunded (£)"].join(","),
    ...orders.map((o) =>
      [o.number, o.paidAt?.toISOString().slice(0, 10) ?? "", esc(o.items.map((i) => i.title).join("; ")), o.status, (o.sellerEarningsPence / 100).toFixed(2), (o.refundedPence / 100).toFixed(2)].join(","),
    ),
  ];
  return new NextResponse(rows.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="passalong-income-${year}.csv"`, "cache-control": "private, no-store" },
  });
}
