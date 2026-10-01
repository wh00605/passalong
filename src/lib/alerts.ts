import "server-only";
import { db } from "@/lib/db";
import { searchListings, type SearchParams } from "@/lib/listings";
import { toQueryString } from "@/lib/search-params";
import { notify } from "@/lib/notify";

/** Notifies members about new items matching their saved searches (at most once per search per run). */
export async function runSavedSearchAlerts(now = new Date()) {
  const searches = await db.savedSearch.findMany({
    where: { alertsEnabled: true, lastCheckedAt: { lt: new Date(now.getTime() - 60 * 60_000) }, user: { deletedAt: null } },
    take: 500,
    orderBy: { lastCheckedAt: "asc" },
  });
  let notified = 0;
  for (const s of searches) {
    const filters = s.filters as SearchParams;
    const res = await searchListings({ ...filters, sort: "newest", page: 1, publishedAfter: s.lastCheckedAt, excludeSellerId: s.userId });
    if (res.total > 0) {
      await notify({
        userId: s.userId,
        type: "SAVED_SEARCH_MATCH",
        title: `${res.total} new item${res.total === 1 ? "" : "s"} for “${s.name}”`,
        body: res.items.slice(0, 3).map((i) => i.title).join(", "),
        url: `/search?${toQueryString({ ...filters, sort: "newest" })}`,
      });
      notified++;
    }
    await db.savedSearch.update({ where: { id: s.id }, data: { lastCheckedAt: now } });
  }
  return { checked: searches.length, notified };
}
