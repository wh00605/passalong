import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export type CategoryNode = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  sizeGroupId: string | null;
  isProhibited: boolean;
  children: CategoryNode[];
};

/** Full category tree, cached for 10 minutes and invalidated by the "catalogue" tag. */
export const getCategoryTree = unstable_cache(
  async (): Promise<CategoryNode[]> => {
    const rows = await db.category.findMany({ where: { isActive: true }, orderBy: [{ position: "asc" }, { name: "asc" }] });
    const nodes = new Map<string, CategoryNode>(
      rows.map((r) => [r.id, { id: r.id, name: r.name, path: r.path, parentId: r.parentId, sizeGroupId: r.sizeGroupId, isProhibited: r.isProhibited, children: [] }]),
    );
    const roots: CategoryNode[] = [];
    for (const n of nodes.values()) {
      if (n.parentId && nodes.has(n.parentId)) nodes.get(n.parentId)!.children.push(n);
      else if (!n.parentId) roots.push(n);
    }
    return roots;
  },
  ["category-tree"],
  { revalidate: 600, tags: ["catalogue"] },
);

export const getTopCategories = cache(async () => (await getCategoryTree()).map(({ children, ...c }) => (void children, c)));

export function flattenTree(nodes: CategoryNode[], depth = 0): (CategoryNode & { depth: number })[] {
  return nodes.flatMap((n) => [{ ...n, depth }, ...flattenTree(n.children, depth + 1)]);
}

export async function findCategoryByPath(path: string) {
  const all = flattenTree(await getCategoryTree());
  return all.find((c) => c.path === path) ?? null;
}

/** Ids of a category and all its descendants. */
export function descendantIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(descendantIds)];
}

/** Ancestors from root to the node itself. */
export async function categoryTrail(categoryId: string) {
  const all = flattenTree(await getCategoryTree());
  const byId = new Map(all.map((c) => [c.id, c]));
  const trail: CategoryNode[] = [];
  for (let c = byId.get(categoryId); c; c = c.parentId ? byId.get(c.parentId) : undefined) trail.unshift(c);
  return trail;
}

export const getFilterOptions = unstable_cache(
  async () => {
    const [brands, colours, materials, sizeGroups, parcelSizes] = await Promise.all([
      db.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
      db.colour.findMany({ orderBy: { name: "asc" } }),
      db.material.findMany({ orderBy: { name: "asc" } }),
      db.sizeGroup.findMany({ include: { sizes: { orderBy: { position: "asc" } } }, orderBy: { name: "asc" } }),
      db.parcelSize.findMany({ orderBy: { position: "asc" } }),
    ]);
    return { brands, colours, materials, sizeGroups, parcelSizes };
  },
  ["filter-options"],
  { revalidate: 600, tags: ["catalogue"] },
);

/** Brand ids ordered by number of listings ever created (for ordering pickers). */
export async function popularBrandIds(limit = 30): Promise<string[]> {
  const rows = await db.listing.groupBy({
    by: ["brandId"],
    where: { brandId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { brandId: "desc" } },
    take: limit,
  });
  return rows.map((r) => r.brandId!);
}

export { CONDITIONS, conditionLabel } from "@/lib/conditions";
