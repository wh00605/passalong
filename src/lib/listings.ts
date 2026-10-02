import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { descendantIds, findCategoryByPath, getCategoryTree as getCategoryTreeForCovers } from "@/lib/catalogue";

/** Fields needed to render a listing card. */
export const cardSelect = {
  id: true,
  title: true,
  pricePence: true,
  status: true,
  condition: true,
  favouriteCount: true,
  bumpedUntil: true,
  publishedAt: true,
  brand: { select: { name: true } },
  customBrand: true,
  size: { select: { label: true } },
  photos: { orderBy: { position: "asc" }, take: 1, select: { storageKey: true, width: true, height: true, blurData: true } },
  seller: { select: { username: true, name: true, image: true } },
} satisfies Prisma.ListingSelect;

export type ListingCardData = Prisma.ListingGetPayload<{ select: typeof cardSelect }>;

/** Conditions every publicly visible listing must meet. */
export const visibleWhere: Prisma.ListingWhereInput = {
  status: { in: ["ACTIVE", "RESERVED"] },
  moderationStatus: "OK",
  seller: { holidayMode: false, deletedAt: null, OR: [{ banned: false }, { banned: null }] },
};

export const SORTS = {
  relevance: "Relevance",
  newest: "Newest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
} as const;
export type SortKey = keyof typeof SORTS;

export type SearchParams = {
  q?: string;
  category?: string;
  brand?: string[];
  size?: string[];
  condition?: string[];
  colour?: string[];
  material?: string[];
  priceMin?: number;
  priceMax?: number;
  sort?: SortKey;
  page?: number;
  sellerId?: string;
  /** Only listings first published after this time (saved-search alerts). */
  publishedAfter?: Date;
  excludeSellerId?: string;
};

export const PAGE_SIZE = 24;

function tokens(q: string) {
  return q
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9&'+.]+/)
    .filter((t) => t.length >= 1)
    .slice(0, 8);
}

function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Full-text-ish search with filters. Uses the pg_trgm GIN index on searchText. */
export async function searchListings(p: SearchParams) {
  const page = Math.max(1, Math.min(p.page ?? 1, 200));
  const where: Prisma.Sql[] = [
    Prisma.sql`l."status" IN ('ACTIVE','RESERVED')`,
    Prisma.sql`l."moderationStatus" = 'OK'`,
    Prisma.sql`u."holidayMode" = false AND u."deletedAt" IS NULL AND COALESCE(u."banned", false) = false`,
  ];

  const q = (p.q ?? "").trim().slice(0, 100);
  const toks = q ? tokens(q) : [];
  for (const t of toks) where.push(Prisma.sql`l."searchText" LIKE ${`%${likeEscape(t)}%`}`);

  if (p.category) {
    const node = await findCategoryByPath(p.category);
    if (node) where.push(Prisma.sql`l."categoryId" IN (${Prisma.join(descendantIds(node))})`);
  }
  if (p.brand?.length) where.push(Prisma.sql`l."brandId" IN (${Prisma.join(p.brand)})`);
  if (p.size?.length) where.push(Prisma.sql`l."sizeId" IN (${Prisma.join(p.size)})`);
  if (p.condition?.length) where.push(Prisma.sql`l."condition"::text IN (${Prisma.join(p.condition)})`);
  if (p.material?.length) where.push(Prisma.sql`l."materialId" IN (${Prisma.join(p.material)})`);
  if (p.colour?.length) {
    where.push(Prisma.sql`EXISTS (SELECT 1 FROM "_ColourToListing" cl WHERE cl."B" = l."id" AND cl."A" IN (${Prisma.join(p.colour)}))`);
  }
  if (p.priceMin != null) where.push(Prisma.sql`l."pricePence" >= ${p.priceMin}`);
  if (p.priceMax != null) where.push(Prisma.sql`l."pricePence" <= ${p.priceMax}`);
  if (p.sellerId) where.push(Prisma.sql`l."sellerId" = ${p.sellerId}`);
  if (p.excludeSellerId) where.push(Prisma.sql`l."sellerId" <> ${p.excludeSellerId}`);
  if (p.publishedAfter) where.push(Prisma.sql`l."publishedAt" > ${p.publishedAfter}`);

  const sort: SortKey = p.sort && p.sort in SORTS ? p.sort : q ? "relevance" : "newest";
  const bumped = Prisma.sql`(CASE WHEN l."bumpedUntil" > now() THEN 1 ELSE 0 END)`;
  const order =
    sort === "price_asc"
      ? Prisma.sql`l."pricePence" ASC, l."publishedAt" DESC`
      : sort === "price_desc"
        ? Prisma.sql`l."pricePence" DESC, l."publishedAt" DESC`
        : sort === "newest"
          ? Prisma.sql`l."publishedAt" DESC NULLS LAST`
          : q
            ? Prisma.sql`(word_similarity(${q.toLowerCase()}, l."searchText") + CASE WHEN lower(l."title") LIKE ${`%${likeEscape(q.toLowerCase())}%`} THEN 0.5 ELSE 0 END + ${bumped} * 0.3) DESC, l."publishedAt" DESC`
            : Prisma.sql`${bumped} DESC, l."publishedAt" DESC`;

  const whereSql = Prisma.join(where, " AND ");
  const [rows, countRows] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT l."id" FROM "Listing" l JOIN "user" u ON u."id" = l."sellerId"
      WHERE ${whereSql}
      ORDER BY ${order}
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Listing" l JOIN "user" u ON u."id" = l."sellerId" WHERE ${whereSql}`,
  ]);

  const ids = rows.map((r) => r.id);
  const listings = await db.listing.findMany({ where: { id: { in: ids } }, select: cardSelect });
  const byId = new Map(listings.map((l) => [l.id, l]));
  return {
    items: ids.map((id) => byId.get(id)).filter((l): l is ListingCardData => !!l),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageCount: Math.max(1, Math.ceil(Number(countRows[0]?.count ?? 0) / PAGE_SIZE)),
    sort,
  };
}

/**
 * Re-orders a ranked list so the same seller doesn't appear twice in a row where avoidable,
 * keeping the original ranking as much as possible.
 */
export function diversifyBySeller<T extends { seller: { username: string } }>(items: T[]): T[] {
  const queue = [...items];
  const out: T[] = [];
  while (queue.length) {
    const last = out.at(-1)?.seller.username;
    const idx = queue.findIndex((i) => i.seller.username !== last);
    out.push(...queue.splice(idx === -1 ? 0 : idx, 1));
  }
  return out;
}

/** Home feed. Signed-in members with personalisation on get items ranked by their sizes, brands and recent views. */
export async function personalisedFeed(userId: string | null, limit = 36): Promise<ListingCardData[]> {
  return diversifyBySeller(await rankedFeed(userId, limit));
}

async function rankedFeed(userId: string | null, limit: number): Promise<ListingCardData[]> {
  const candidates = await db.listing.findMany({
    where: { ...visibleWhere, status: "ACTIVE", ...(userId ? { sellerId: { not: userId } } : {}) },
    orderBy: { publishedAt: "desc" },
    take: 300,
    select: { ...cardSelect, brandId: true, sizeId: true, categoryId: true },
  });
  if (!userId) return candidates.slice(0, limit);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { allowPersonalisation: true, preferredBrandIds: true, preferredSizeIds: true },
  });
  if (!user?.allowPersonalisation) return candidates.slice(0, limit);

  const [views, favs] = await Promise.all([
    db.listingView.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { listing: { select: { brandId: true, categoryId: true, sizeId: true } } },
    }),
    db.favourite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { listing: { select: { brandId: true, categoryId: true, sizeId: true } } },
    }),
  ]);
  const signals = [...views, ...favs].map((v) => v.listing);
  const brandScore = new Map<string, number>();
  const catScore = new Map<string, number>();
  const sizeScore = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string | null, w: number) => k && m.set(k, (m.get(k) ?? 0) + w);
  for (const s of signals) {
    bump(brandScore, s.brandId, 1);
    bump(catScore, s.categoryId, 1);
    bump(sizeScore, s.sizeId, 1);
  }
  for (const b of user.preferredBrandIds) bump(brandScore, b, 5);
  for (const s of user.preferredSizeIds) bump(sizeScore, s, 5);

  const now = Date.now();
  const scored = candidates.map((c) => {
    const ageDays = (now - (c.publishedAt?.getTime() ?? now)) / 86_400_000;
    const score =
      Math.min(brandScore.get(c.brandId ?? "") ?? 0, 8) * 1.5 +
      Math.min(sizeScore.get(c.sizeId ?? "") ?? 0, 8) * 2 +
      Math.min(catScore.get(c.categoryId ?? "") ?? 0, 8) * 1 +
      (c.bumpedUntil && c.bumpedUntil.getTime() > now ? 3 : 0) -
      ageDays * 0.4;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.c);
}

export async function similarListings(listing: { id: string; categoryId: string | null; brandId: string | null; sizeId: string | null; pricePence: number }, limit = 12) {
  if (!listing.categoryId) return [];
  const candidates = await db.listing.findMany({
    where: {
      ...visibleWhere,
      status: "ACTIVE",
      id: { not: listing.id },
      categoryId: listing.categoryId,
      pricePence: { gte: Math.floor(listing.pricePence * 0.4), lte: Math.ceil(listing.pricePence * 2) },
    },
    orderBy: { publishedAt: "desc" },
    take: 60,
    select: { ...cardSelect, brandId: true, sizeId: true },
  });
  return candidates
    .map((c) => ({ c, s: (c.brandId && c.brandId === listing.brandId ? 2 : 0) + (c.sizeId && c.sizeId === listing.sizeId ? 1 : 0) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

/** One cover photo per top-level category (newest live listing with a photo). */
export async function categoryCovers(categoryIds: string[]) {
  const tree = await getCategoryTreeForCovers();
  const out = new Map<string, ListingCardData["photos"][number]>();
  for (const id of categoryIds) {
    const node = tree.find((n) => n.id === id);
    if (!node) continue;
    const l = await db.listing.findFirst({
      where: { ...visibleWhere, status: "ACTIVE", categoryId: { in: descendantIds(node) }, photos: { some: {} } },
      orderBy: { publishedAt: "desc" },
      select: { photos: { orderBy: { position: "asc" }, take: 1, select: { storageKey: true, width: true, height: true, blurData: true } } },
    });
    if (l?.photos[0]) out.set(id, l.photos[0]);
  }
  return out;
}

/** Members with the most live items – shown as "wardrobes to follow". */
export async function topWardrobes(limit = 6, excludeUserId?: string) {
  const rows = await db.listing.groupBy({
    by: ["sellerId"],
    where: { ...visibleWhere, status: "ACTIVE", ...(excludeUserId ? { sellerId: { not: excludeUserId } } : {}) },
    _count: { _all: true },
    orderBy: { _count: { sellerId: "desc" } },
    take: limit,
  });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.sellerId) } },
    select: {
      id: true, name: true, username: true, image: true, ratingAvg: true, ratingCount: true, location: true, followerCount: true,
      listings: { where: { ...visibleWhere, status: "ACTIVE" }, orderBy: { publishedAt: "desc" }, take: 3, select: { id: true, title: true, photos: { orderBy: { position: "asc" }, take: 1, select: { storageKey: true, width: true, height: true, blurData: true } } } },
    },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...byId.get(r.sellerId)!, activeCount: r._count._all })).filter((u) => u.username);
}

/** Brands with the most live listings (real counts, no editorial boosting). */
export async function popularBrands(limit = 10) {
  const rows = await db.listing.groupBy({
    by: ["brandId"],
    where: { ...visibleWhere, status: "ACTIVE", brandId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { brandId: "desc" } },
    take: limit,
  });
  const brands = await db.brand.findMany({ where: { id: { in: rows.map((r) => r.brandId!) } }, select: { id: true, name: true, slug: true } });
  const byId = new Map(brands.map((b) => [b.id, b]));
  return rows.map((r) => ({ ...byId.get(r.brandId!)!, count: r._count._all })).filter((b) => b.name);
}

export async function spotlightWardrobes(limit = 4) {
  const promos = await db.promotion.findMany({
    where: { type: "WARDROBE_SPOTLIGHT", status: "ACTIVE", endsAt: { gt: new Date() }, user: { holidayMode: false, deletedAt: null } },
    take: limit,
    orderBy: { startsAt: "desc" },
    select: {
      user: {
        select: {
          id: true, name: true, username: true, image: true, ratingAvg: true, ratingCount: true,
          listings: { where: { ...visibleWhere, status: "ACTIVE" }, take: 4, orderBy: { publishedAt: "desc" }, select: cardSelect },
        },
      },
    },
  });
  return promos.map((p) => p.user).filter((u) => u.listings.length > 0);
}
