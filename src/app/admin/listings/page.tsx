import Link from "next/link";
import { db } from "@/lib/db";
import { listingPath } from "@/lib/slug";
import { formatPence } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { AdminAction } from "../admin-action";
import { moderateListingAction } from "../actions";

export const metadata = { title: "Listings" };

export default async function AdminListings({ searchParams }: PageProps<"/admin/listings">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 100) : "";
  const listings = await db.listing.findMany({
    where: q ? { OR: [{ searchText: { contains: q } }, { id: q }, { seller: { username: q } }] } : {},
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { seller: { select: { username: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">Listings</h1>
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search listings</label>
        <input id="q" name="q" defaultValue={q} placeholder="Words, listing ID or seller username" className="input max-w-md" />
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <caption className="sr-only">Listings</caption>
          <thead><tr className="text-left font-mono text-xs uppercase"><th scope="col" className="py-2">Title</th><th scope="col">Seller</th><th scope="col">Price</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {listings.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="py-2"><Link href={listingPath(l)} className="link" target="_blank">{l.title || "(untitled)"}</Link></td>
                <td>@{l.seller.username}</td>
                <td className="font-mono">{formatPence(l.pricePence)}</td>
                <td className="text-xs">{l.status.toLowerCase()} / {l.moderationStatus.toLowerCase()}</td>
                <td className="font-mono text-xs">{timeAgo(l.updatedAt)}</td>
                <td className="space-x-1">
                  {l.moderationStatus === "PENDING_REVIEW" && <AdminAction action={moderateListingAction.bind(null, l.id, "approve", undefined)} label="Approve" />}
                  {l.moderationStatus !== "REMOVED" ? (
                    <AdminAction action={moderateListingAction.bind(null, l.id, "remove", undefined)} label="Remove" fields={["reason"]} danger />
                  ) : (
                    <AdminAction action={moderateListingAction.bind(null, l.id, "restore", undefined)} label="Restore" fields={["reason"]} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
