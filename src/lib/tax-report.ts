import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { decrypt } from "@/lib/crypto";

/** Sellers above the HMRC / DAC7 reporting threshold for a calendar year. */
export async function reportableSellers(year: number) {
  const s = await getSettings();
  const from = new Date(`${year}-01-01T00:00:00Z`);
  const to = new Date(`${year + 1}-01-01T00:00:00Z`);
  const rows = await db.order.groupBy({
    by: ["sellerId"],
    where: { paidAt: { gte: from, lt: to }, status: { in: ["COMPLETED"] } },
    _count: { _all: true },
    _sum: { sellerEarningsPence: true, refundedPence: true, itemsSubtotalPence: true, bundleDiscountPence: true },
  });
  const qualifying = rows.filter((r) => {
    const consideration = (r._sum.sellerEarningsPence ?? 0) - (r._sum.refundedPence ?? 0);
    return r._count._all >= s.taxReportSalesThreshold || consideration >= s.taxReportIncomePence;
  });
  const users = await db.user.findMany({
    where: { id: { in: qualifying.map((r) => r.sellerId) } },
    select: { id: true, username: true, email: true, taxProfile: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return qualifying.map((r) => {
    const u = byId.get(r.sellerId)!;
    const gross = (r._sum.itemsSubtotalPence ?? 0) - (r._sum.bundleDiscountPence ?? 0);
    return {
      userId: r.sellerId,
      username: u.username,
      email: u.email,
      sales: r._count._all,
      considerationPence: (r._sum.sellerEarningsPence ?? 0) - (r._sum.refundedPence ?? 0),
      feesPence: gross - (r._sum.sellerEarningsPence ?? 0),
      hasTaxProfile: !!u.taxProfile,
      profile: u.taxProfile,
    };
  });
}

export async function reportCsv(year: number) {
  const rows = await reportableSellers(year);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["seller_id", "username", "email", "seller_type", "legal_name", "date_of_birth", "tin", "company_number", "address_line1", "address_line2", "city", "postcode", "country", "sales_count", "consideration_gbp", "fees_gbp"];
  const lines = rows.map((r) => {
    let tin = "";
    try {
      tin = r.profile?.tinEncrypted ? decrypt(r.profile.tinEncrypted) : "";
    } catch {
      tin = "DECRYPTION_FAILED";
    }
    return [
      r.userId, r.username, r.email, r.profile?.sellerType, r.profile?.legalName, r.profile?.dateOfBirth?.toISOString().slice(0, 10), tin,
      r.profile?.companyNumber, r.profile?.addressLine1, r.profile?.addressLine2, r.profile?.city, r.profile?.postcode, r.profile?.country,
      r.sales, (r.considerationPence / 100).toFixed(2), (r.feesPence / 100).toFixed(2),
    ].map(esc).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}
