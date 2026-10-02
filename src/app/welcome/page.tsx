import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getFilterOptions, popularBrandIds } from "@/lib/catalogue";
import { PersonalisationForm } from "@/app/settings/personalisation/personalisation-form";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const sp = await searchParams;
  if (sp.error) redirect("/verify-email?error=1");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { sizeGroups, brands } = await getFilterOptions();
  const featured = new Set(await popularBrandIds(30));
  return (
    <div className="container-page max-w-4xl py-10">
      <p className="eyebrow">Step 1 of 1 · optional</p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">
        Welcome, {user.name.split(" ")[0]}. <span className="bg-accent-400 px-1">Let&apos;s tune your feed.</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        Pick your sizes and a few brands you love. You can change these any time in settings.
      </p>
      <PersonalisationForm
        sizeGroups={sizeGroups.map((g) => ({ id: g.id, name: g.name, sizes: g.sizes.map((s) => ({ id: s.id, label: s.label })) }))}
        brands={brands.filter((b) => featured.size === 0 || featured.has(b.id) || user.preferredBrandIds.includes(b.id)).concat(brands.filter((b) => featured.size > 0 && !featured.has(b.id) && !user.preferredBrandIds.includes(b.id)))}
        selectedSizes={user.preferredSizeIds}
        selectedBrands={user.preferredBrandIds}
        next="/"
      />
      <p className="mt-6">
        <Link href="/" className="link">Skip for now</Link>
      </p>
    </div>
  );
}
