import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/storage";
import { ListingForm } from "@/components/sell/listing-form";
import { loadListingFormData } from "@/components/sell/load-form-data";

export const metadata: Metadata = { title: "Edit item", robots: { index: false } };

export default async function EditListingPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/items/${id}/edit`);
  const listing = await db.listing.findFirst({
    where: { id, sellerId: user.id, status: { notIn: ["SOLD", "DELETED", "REMOVED"] } },
    include: { photos: { orderBy: { position: "asc" } }, colours: { select: { id: true } }, brand: { select: { name: true } } },
  });
  if (!listing) notFound();
  const data = await loadListingFormData();
  return (
    <div className="container-page max-w-3xl py-8">
      <p className="eyebrow">{listing.status === "DRAFT" ? "Draft" : "Edit listing"}</p>
      <h1 className="mt-1 text-4xl font-extrabold">{listing.title || "Untitled draft"}</h1>
      <div className="mt-6">
        <ListingForm
          {...data}
          initial={{
            id: listing.id, title: listing.title, description: listing.description, categoryId: listing.categoryId,
            brandId: listing.brandId, brandName: listing.brand?.name ?? null, customBrand: listing.customBrand,
            sizeId: listing.sizeId, condition: listing.condition, colourIds: listing.colours.map((c) => c.id),
            materialId: listing.materialId, pricePence: listing.pricePence, parcelSizeId: listing.parcelSizeId,
            status: listing.status, photos: listing.photos.map((p) => ({ id: p.id, url: photoUrl(p.storageKey, 320) })),
          }}
        />
      </div>
    </div>
  );
}
