import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { listingPath } from "@/lib/slug";
import { visibleWhere } from "@/lib/listings";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, categories, brands, members, articles] = await Promise.all([
    db.listing.findMany({ where: { ...visibleWhere, status: "ACTIVE" }, select: { id: true, title: true, updatedAt: true }, orderBy: { publishedAt: "desc" }, take: 40_000 }),
    db.category.findMany({ where: { isActive: true, isProhibited: false }, select: { path: true } }),
    db.brand.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.user.findMany({ where: { deletedAt: null, allowSearchIndexing: true, holidayMode: false, listings: { some: { status: "ACTIVE" } } }, select: { username: true }, take: 5000 }),
    db.helpArticle.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const legal = ["terms", "privacy", "cookies", "buyer-protection", "prohibited-items", "catalogue-rules", "accessibility"];
  return [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    ...categories.map((c) => ({ url: `${siteUrl}/c/${c.path}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...brands.map((b) => ({ url: `${siteUrl}/brands/${b.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...listings.map((l) => ({ url: `${siteUrl}${listingPath(l)}`, lastModified: l.updatedAt, priority: 0.7 })),
    ...members.map((m) => ({ url: `${siteUrl}/members/${m.username}`, changeFrequency: "daily" as const, priority: 0.4 })),
    { url: `${siteUrl}/help`, priority: 0.5 },
    ...articles.map((a) => ({ url: `${siteUrl}/help/${a.slug}`, lastModified: a.updatedAt, priority: 0.4 })),
    ...legal.map((s) => ({ url: `${siteUrl}/legal/${s}`, priority: 0.2 })),
  ];
}
