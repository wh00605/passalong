import { requireUser } from "@/lib/session";
import { getFilterOptions } from "@/lib/catalogue";
import { PersonalisationForm } from "./personalisation-form";

export default async function PersonalisationPage() {
  const user = await requireUser();
  const { sizeGroups, brands } = await getFilterOptions();
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-medium">Sizes & brands</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        We use these to put items you&apos;re more likely to love at the top of your feed. You can switch personalisation off in Privacy.
      </p>
      <PersonalisationForm
        sizeGroups={sizeGroups.map((g) => ({ id: g.id, name: g.name, sizes: g.sizes.map((s) => ({ id: s.id, label: s.label })) }))}
        brands={brands}
        selectedSizes={user.preferredSizeIds}
        selectedBrands={user.preferredBrandIds}
      />
    </section>
  );
}
