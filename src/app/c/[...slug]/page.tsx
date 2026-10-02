import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchView } from "@/components/search/search-view";
import { parseSearchParams } from "@/lib/search-params";
import { categoryTrail, findCategoryByPath } from "@/lib/catalogue";

export async function generateMetadata({ params }: PageProps<"/c/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = await findCategoryByPath(slug.join("/"));
  if (!cat) return { title: "Category not found" };
  const trail = await categoryTrail(cat.id);
  const name = trail.map((c) => c.name).join(" ");
  return {
    title: `Second-hand ${name}`,
    description: `Shop pre-loved ${name.toLowerCase()} from sellers across the UK. Buyer Protection on every order.`,
    alternates: { canonical: `/c/${cat.path}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/c/[...slug]">) {
  const { slug } = await params;
  const path = slug.join("/");
  const cat = await findCategoryByPath(path);
  if (!cat || cat.isProhibited) notFound();
  const trail = await categoryTrail(cat.id);
  const search = parseSearchParams(await searchParams, { category: path });

  return (
    <SearchView
      params={search}
      basePath={`/c/${path}`}
      fixed={{ category: path }}
      heading={trail.length > 1 ? `${trail[0].name} › ${cat.name}` : cat.name}
      intro={
        cat.children.length > 0 ? (
          <nav aria-label={`${cat.name} subcategories`} className="mt-4">
            <ul className="flex flex-wrap gap-2">
              {cat.children.filter((c) => !c.isProhibited).map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${c.path}`} className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-brand-50">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null
      }
    />
  );
}
