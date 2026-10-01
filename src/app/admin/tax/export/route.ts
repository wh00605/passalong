import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { reportCsv } from "@/lib/tax-report";
import { audit } from "@/lib/audit";

/** Admin-only export of the annual seller report (contains decrypted tax IDs – handle securely). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear() - 1;
  await audit(user.id, "tax.export", "taxReport", String(year));
  return new NextResponse(await reportCsv(year), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="passalong-seller-report-${year}.csv"`, "cache-control": "private, no-store" },
  });
}
