import { ListingCard } from "@/components/listing-card";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import type { ListingCardData } from "@/lib/listings";

export async function ListingGrid({
  listings,
  empty = "No items to show yet.",
  priorityCount = 4,
  gridClassName = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
}: {
  listings: ListingCardData[];
  empty?: React.ReactNode;
  priorityCount?: number;
  gridClassName?: string;
}) {
  if (listings.length === 0) return <p className="rounded-xl bg-surface p-8 text-center text-muted">{empty}</p>;
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const favs = user
    ? new Set(
        (
          await db.favourite.findMany({
            where: { userId: user.id, listingId: { in: listings.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId),
      )
    : new Set<string>();
  return (
    <ul className={`grid gap-x-4 gap-y-9 sm:gap-x-6 ${gridClassName}`} role="list">
      {listings.map((l, i) => (
        <li key={l.id}>
          <ListingCard listing={l} fees={settings} favourited={favs.has(l.id)} signedIn={!!user} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
