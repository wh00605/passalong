import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";
import { parseSearchParams } from "@/lib/search-params";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  return {
    title: q ? `${q} – second-hand` : "Search pre-loved items",
    // Search result pages are thin/duplicative for SEO; category and brand pages are the indexable ones.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = parseSearchParams(await searchParams);
  return <SearchView params={params} basePath="/search" heading={params.q ? `“${params.q}”` : "All items"} />;
}
