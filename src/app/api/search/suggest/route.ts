import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { flattenTree, getCategoryTree } from "@/lib/catalogue";
import { checkRateLimit } from "@/lib/rate-limit";

/** Autocomplete: matching brands, categories and listing titles. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`suggest:${ip}`, 120, 60))) return NextResponse.json({ suggestions: [] }, { status: 429 });

  const [brands, titles, tree] = await Promise.all([
    db.brand.findMany({ where: { isActive: true, name: { contains: q, mode: "insensitive" } }, take: 4, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    db.$queryRaw<{ title: string }[]>`
      SELECT DISTINCT ON (lower(l."title")) l."title" FROM "Listing" l
      WHERE l."status" = 'ACTIVE' AND l."moderationStatus" = 'OK' AND l."searchText" LIKE ${`%${q.replace(/[\\%_]/g, "\\$&")}%`}
      ORDER BY lower(l."title"), similarity(lower(l."title"), ${q}) DESC
      LIMIT 5`,
    getCategoryTree(),
  ]);
  const cats = flattenTree(tree)
    .filter((c) => c.name.toLowerCase().includes(q) && !c.isProhibited)
    .slice(0, 3);
  const pathName = (path: string) => path.split("/").map((p) => p[0].toUpperCase() + p.slice(1).replace(/-/g, " ")).join(" › ");

  return NextResponse.json(
    {
      suggestions: [
        { type: "query", label: q, href: `/search?q=${encodeURIComponent(q)}` },
        ...titles.map((t) => ({ type: "query", label: t.title, href: `/search?q=${encodeURIComponent(t.title)}` })),
        ...brands.map((b) => ({ type: "brand", label: b.name, href: `/brands/${b.slug}` })),
        ...cats.map((c) => ({ type: "category", label: pathName(c.path), href: `/c/${c.path}` })),
      ].slice(0, 10),
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
