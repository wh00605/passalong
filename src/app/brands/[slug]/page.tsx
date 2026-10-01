import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SearchView } from "@/components/search/search-view";
import { parseSearchParams } from "@/lib/search-params";

async function load(slug: string) {
  return db.brand.findFirst({ where: { slug, isActive: true } });
}

export async function generateMetadata({ params }: PageProps<"/brands/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const brand = await load(slug);
  if (!brand) return { title: "Brand not found" };
  return {
    title: `Second-hand ${brand.name}`,
    description: `Shop pre-loved ${brand.name} from sellers across the UK on Passalong.`,
    alternates: { canonical: `/brands/${brand.slug}` },
  };
}

export default async function BrandPage({ params, searchParams }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  const brand = await load(slug);
  if (!brand) notFound();
  const search = parseSearchParams(await searchParams, { brand: [brand.id] });
  return <SearchView params={search} basePath={`/brands/${brand.slug}`} fixed={{ brand: [brand.id] }} heading={brand.name} />;
}
