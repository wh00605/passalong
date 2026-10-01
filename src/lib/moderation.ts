import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { matchProhibited, type ProhibitedResult } from "@/lib/prohibited";

const getTerms = unstable_cache(
  async () => db.prohibitedTerm.findMany({ select: { term: true, severity: true, note: true } }),
  ["prohibited-terms"],
  { revalidate: 300, tags: ["prohibited-terms"] },
);

export type ListingCheck = ProhibitedResult & { categoryProhibited: boolean };

/** Prohibited-items policy enforced at listing time (keyword + category checks). */
export async function checkListingContent(input: { title: string; description: string; brandName?: string | null; categoryId?: string | null }): Promise<ListingCheck> {
  const [terms, category] = await Promise.all([
    getTerms(),
    input.categoryId ? db.category.findUnique({ where: { id: input.categoryId }, select: { isProhibited: true } }) : null,
  ]);
  const result = matchProhibited(`${input.title}\n${input.description}\n${input.brandName ?? ""}`, terms);
  return { ...result, categoryProhibited: !!category?.isProhibited };
}
