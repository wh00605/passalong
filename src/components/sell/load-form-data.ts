import "server-only";
import { getCategoryTree, getFilterOptions, type CategoryNode } from "@/lib/catalogue";
import { getSettings } from "@/lib/settings";
import type { ListingFormProps } from "@/components/sell/listing-form";

type Cat = ListingFormProps["tree"][number];
const strip = (n: CategoryNode): Cat => ({ id: n.id, name: n.name, sizeGroupId: n.sizeGroupId, isProhibited: n.isProhibited, children: n.children.map(strip) });

export async function loadListingFormData(): Promise<Omit<ListingFormProps, "initial">> {
  const [tree, opts, settings] = await Promise.all([getCategoryTree(), getFilterOptions(), getSettings()]);
  return {
    tree: tree.map(strip),
    sizeGroups: opts.sizeGroups.map((g) => ({ id: g.id, sizes: g.sizes.map((s) => ({ id: s.id, label: s.label })) })),
    brands: opts.brands.map((b) => ({ id: b.id, name: b.name })),
    colours: opts.colours.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
    materials: opts.materials.map((m) => ({ id: m.id, name: m.name })),
    parcels: opts.parcelSizes.map((p) => ({ id: p.id, name: p.name, description: p.description, pricePence: p.pricePence })),
    fees: {
      buyerProtectionFixedPence: settings.buyerProtectionFixedPence,
      buyerProtectionPercentBps: settings.buyerProtectionPercentBps,
      sellerCommissionBps: settings.sellerCommissionBps,
    },
    maxPhotos: settings.maxPhotosPerListing,
  };
}
