import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { reportableSellers } from "@/lib/tax-report";
import { formatPence } from "@/lib/money";

export const metadata = { title: "Tax reporting" };

export default async function TaxReportPage({ searchParams }: PageProps<"/admin/tax">) {
  await requireAdmin();
  const sp = await searchParams;
  const year = Number(sp.year) || new Date().getFullYear() - 1;
  const rows = await reportableSellers(year);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">Tax reporting {year}</h1>
      <p className="max-w-3xl text-sm text-muted">
        Sellers meeting the reporting threshold for the calendar year under the UK Reporting Rules for Digital Platforms (and EU DAC7 for EU-resident sellers). Reports for a calendar year are due to HMRC by 31 January the following year, and sellers must be given a copy of their data. TODO(legal/ops): confirm the submission format and the HMRC online service before the first filing.
      </p>
      <form className="flex gap-2">
        <label htmlFor="year" className="sr-only">Year</label>
        <input id="year" name="year" type="number" defaultValue={year} className="input w-32" />
        <button type="submit" className="btn-secondary">Show</button>
        <Link href={`/admin/tax/export?year=${year}`} className="btn-primary">Export CSV</Link>
      </form>
      <p className="text-sm"><strong>{rows.length}</strong> reportable sellers. {rows.filter((r) => !r.hasTaxProfile).length} are missing tax details.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Reportable sellers</caption>
          <thead><tr className="text-left font-mono text-xs uppercase"><th scope="col" className="py-2">Seller</th><th scope="col">Sales</th><th scope="col">Consideration</th><th scope="col">Fees withheld</th><th scope="col">Tax details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="py-2"><Link href={`/admin/users/${r.userId}`} className="link">@{r.username}</Link></td>
                <td className="font-mono">{r.sales}</td>
                <td className="font-mono">{formatPence(r.considerationPence)}</td>
                <td className="font-mono">{formatPence(r.feesPence)}</td>
                <td>{r.hasTaxProfile ? "✓" : "Missing"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
