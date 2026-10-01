"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { validatedAction, safeAction } from "@/lib/action";
import { requireUserForAction, ActionError } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parsePounds, formatPence } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { checkListingContent } from "@/lib/moderation";
import { evaluateNewAccountListing } from "@/lib/fraud";
import { buildSearchText } from "@/lib/search-text";
import { categoryTrail, getCategoryTree, flattenTree } from "@/lib/catalogue";
import { notify } from "@/lib/notify";
import { listingPath } from "@/lib/slug";
import { deleteObjects } from "@/lib/storage";
import { PHOTO_WIDTHS } from "@/lib/images";

const list = z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean));
const optId = z.string().trim().max(40).optional().transform((v) => v || null);

const schema = z.object({
  listingId: optId,
  intent: z.enum(["draft", "publish"]),
  title: z.string().trim().max(80, "Keep the title under 80 characters.").default(""),
  description: z.string().trim().max(2000, "Keep the description under 2,000 characters.").default(""),
  categoryId: optId,
  brandId: optId,
  customBrand: z.string().trim().max(60).optional().transform((v) => v || null),
  sizeId: optId,
  condition: z.enum(["NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "VERY_GOOD", "GOOD", "SATISFACTORY"]).optional().or(z.literal("").transform(() => undefined)),
  colourIds: list,
  materialId: optId,
  price: z.string().trim().max(12).default(""),
  parcelSizeId: optId,
  photoIds: list,
});

export const saveListingAction = validatedAction(schema, async (d) => {
  const me = await requireUserForAction();
  await enforceRateLimit("listing-save", me.id, 60, 3600);
  const settings = await getSettings();
  const publishing = d.intent === "publish";
  const errors: Record<string, string[]> = {};
  const err = (k: string, m: string) => (errors[k] = [m]);

  const existing = d.listingId
    ? await db.listing.findFirst({ where: { id: d.listingId, sellerId: me.id }, include: { photos: true } })
    : null;
  if (d.listingId && !existing) throw new ActionError("Listing not found.");
  if (existing && ["SOLD", "DELETED", "REMOVED"].includes(existing.status)) throw new ActionError("This item can no longer be edited.");

  const pricePence = d.price ? parsePounds(d.price) : null;
  if (d.price && pricePence == null) err("price", "Enter a price like 12 or 12.50.");

  // Category must be a real leaf category.
  const all = flattenTree(await getCategoryTree());
  const category = d.categoryId ? all.find((c) => c.id === d.categoryId) : undefined;
  if (d.categoryId && !category) err("categoryId", "Choose a category.");
  if (category && category.children.length > 0) err("categoryId", "Choose a more specific category.");

  const [brand, size, colours, material, parcel] = await Promise.all([
    d.brandId ? db.brand.findFirst({ where: { id: d.brandId, isActive: true } }) : null,
    d.sizeId ? db.size.findUnique({ where: { id: d.sizeId } }) : null,
    d.colourIds.length ? db.colour.findMany({ where: { id: { in: d.colourIds.slice(0, 2) } } }) : [],
    d.materialId ? db.material.findUnique({ where: { id: d.materialId } }) : null,
    d.parcelSizeId ? db.parcelSize.findUnique({ where: { id: d.parcelSizeId } }) : null,
  ]);
  if (size && category && category.sizeGroupId && size.groupId !== category.sizeGroupId) err("sizeId", "Choose a size for this category.");

  // Photos must be uploaded by this member, and either unattached or already on this listing.
  const photoIds = [...new Set(d.photoIds)].slice(0, settings.maxPhotosPerListing);
  const photos = photoIds.length
    ? await db.listingPhoto.findMany({ where: { id: { in: photoIds }, uploaderId: me.id, OR: [{ listingId: null }, { listingId: existing?.id ?? "__none__" }] } })
    : [];
  if (photos.length !== photoIds.length) err("photos", "Some photos couldn't be found – please re-upload them.");

  if (publishing) {
    if (d.title.length < 3) err("title", "Add a title (at least 3 characters).");
    if (d.description.length < 10) err("description", "Add a description (at least 10 characters).");
    if (!category) err("categoryId", "Choose a category.");
    if (category?.sizeGroupId && !size) err("sizeId", "Choose a size.");
    if (!d.condition) err("condition", "Choose the condition.");
    if (pricePence == null) err("price", "Enter a price.");
    else if (pricePence < settings.minListingPricePence) err("price", `The minimum price is ${formatPence(settings.minListingPricePence)}.`);
    else if (pricePence > settings.maxListingPricePence) err("price", `The maximum price is ${formatPence(settings.maxListingPricePence)}.`);
    if (!parcel) err("parcelSizeId", "Choose a parcel size.");
    if (photoIds.length === 0) err("photos", "Add at least one photo.");
  } else if (!d.title) {
    err("title", "Add a title so you can find your draft later.");
  }
  if (Object.keys(errors).length) return { error: "Please check the highlighted fields.", fieldErrors: errors };

  // Prohibited items policy.
  let moderationStatus: "OK" | "PENDING_REVIEW" = existing?.moderationStatus === "PENDING_REVIEW" ? "PENDING_REVIEW" : "OK";
  let moderationNote: string | null = existing?.moderationNote ?? null;
  if (publishing) {
    const check = await checkListingContent({ title: d.title, description: d.description, brandName: brand?.name ?? d.customBrand, categoryId: category?.id });
    if (check.categoryProhibited) throw new ActionError("Items in this category can't be sold on Passalong. See our prohibited items list.");
    if (check.blocked.length) {
      return {
        error: `This listing can't be published because it mentions something that isn't allowed (${check.blocked.map((b) => `“${b.term}”`).join(", ")}). See our prohibited items list.`,
      };
    }
    if (check.review.length) {
      moderationStatus = "PENDING_REVIEW";
      moderationNote = `Keyword review: ${check.review.map((r) => r.term).join(", ")}`;
    }
    if (pricePence != null && (await evaluateNewAccountListing(me.id, pricePence))) {
      moderationStatus = "PENDING_REVIEW";
      moderationNote = [moderationNote, "New account listing a high-value item"].filter(Boolean).join("; ");
    }
  }

  const trail = category ? await categoryTrail(category.id) : [];
  const searchText = buildSearchText({
    title: d.title, description: d.description, brand: brand?.name ?? d.customBrand,
    categoryNames: trail.map((c) => c.name), colours: colours.map((c) => c.name), material: material?.name, size: size?.label,
  });

  const nextStatus = publishing ? (existing && existing.status !== "DRAFT" ? existing.status : "ACTIVE") : existing?.status ?? "DRAFT";
  const data = {
    title: d.title,
    description: d.description,
    categoryId: category?.id ?? null,
    brandId: brand?.id ?? null,
    customBrand: brand ? null : d.customBrand,
    sizeId: size?.id ?? null,
    condition: d.condition ?? null,
    materialId: material?.id ?? null,
    pricePence: pricePence ?? 0,
    parcelSizeId: parcel?.id ?? null,
    status: nextStatus,
    moderationStatus,
    moderationNote,
    searchText,
    colours: { set: colours.map((c) => ({ id: c.id })) },
    ...(publishing && !existing?.publishedAt ? { publishedAt: new Date() } : {}),
  };

  const listing = await db.$transaction(async (tx) => {
    const saved = existing
      ? await tx.listing.update({ where: { id: existing.id }, data })
      : await tx.listing.create({ data: { ...data, sellerId: me.id, colours: { connect: colours.map((c) => ({ id: c.id })) } } });
    // Attach photos in the chosen order and drop any that were removed.
    for (const [position, id] of photoIds.entries()) {
      await tx.listingPhoto.update({ where: { id }, data: { listingId: saved.id, position } });
    }
    if (existing) {
      await tx.listingPhoto.deleteMany({ where: { listingId: saved.id, id: { notIn: photoIds } } });
    }
    if (pricePence != null && pricePence !== existing?.pricePence && saved.status !== "DRAFT") {
      await tx.priceHistory.create({ data: { listingId: saved.id, pricePence } });
    }
    return saved;
  });

  // Clean up storage for photos removed from an existing listing.
  if (existing) {
    const removed = existing.photos.filter((p) => !photoIds.includes(p.id));
    await deleteObjects(removed.flatMap((p) => PHOTO_WIDTHS.map((w) => `${p.storageKey}-${w}.webp`)), "public").catch(() => {});
  }

  // Price drop alerts for members who favourited at a higher price.
  if (existing && pricePence != null && pricePence < existing.pricePence && listing.status === "ACTIVE" && moderationStatus === "OK") {
    const favs = await db.favourite.findMany({ where: { listingId: listing.id, pricePenceAtSave: { gt: pricePence } }, select: { userId: true } });
    await Promise.all(
      favs.map((f) =>
        notify({
          userId: f.userId,
          type: "PRICE_DROP",
          title: `Price drop: ${listing.title}`,
          body: `Now ${formatPence(pricePence)} (was ${formatPence(existing.pricePence)}).`,
          url: listingPath(listing),
        }),
      ),
    );
  }

  revalidatePath("/");
  revalidatePath(listingPath(listing));
  const message = !publishing
    ? "Draft saved."
    : moderationStatus === "PENDING_REVIEW"
      ? "Thanks! Your item is being checked by our team and will go live once approved – usually within a few hours."
      : existing && existing.status !== "DRAFT"
        ? "Changes saved."
        : "Your item is live!";
  return { ok: true, message, data: { id: listing.id, next: publishing ? listingPath(listing) : undefined } };
});

const opSchema = z.object({
  id: z.string().min(1).max(40),
  op: z.enum(["hide", "unhide", "reserve", "unreserve", "markSold", "delete"]),
  username: z.string().trim().toLowerCase().max(20).optional(),
});

export async function listingOpAction(input: z.input<typeof opSchema>) {
  return safeAction(async () => {
    const { id, op, username } = opSchema.parse(input);
    const me = await requireUserForAction();
    const l = await db.listing.findFirst({ where: { id, sellerId: me.id }, include: { photos: true, _count: { select: { orderItems: true } } } });
    if (!l) throw new ActionError("Listing not found.");
    if (["SOLD", "DELETED", "REMOVED"].includes(l.status) && op !== "delete") throw new ActionError("This item can no longer be changed.");
    const pendingOrder = await db.orderItem.count({ where: { listingId: id, order: { status: { in: ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "DISPUTED"] } } } });
    if (pendingOrder && op !== "hide") throw new ActionError("This item is part of an order in progress.");

    switch (op) {
      case "hide":
        if (l.status !== "ACTIVE" && l.status !== "RESERVED") throw new ActionError("Only live items can be hidden.");
        await db.listing.update({ where: { id }, data: { status: "HIDDEN" } });
        break;
      case "unhide":
        if (l.status !== "HIDDEN") throw new ActionError("This item isn't hidden.");
        await db.listing.update({ where: { id }, data: { status: l.reservedForId ? "RESERVED" : "ACTIVE" } });
        break;
      case "reserve": {
        if (!username) throw new ActionError("Enter the buyer's username.");
        const buyer = await db.user.findFirst({ where: { username, deletedAt: null }, select: { id: true, name: true } });
        if (!buyer) throw new ActionError("We couldn't find that member.");
        if (buyer.id === me.id) throw new ActionError("You can't reserve an item for yourself.");
        await db.listing.update({ where: { id }, data: { status: "RESERVED", reservedForId: buyer.id } });
        await notify({ userId: buyer.id, type: "OFFER", title: `${me.name} reserved an item for you`, body: `“${l.title}” is reserved for you – only you can buy it now.`, url: listingPath(l) });
        break;
      }
      case "unreserve":
        await db.listing.update({ where: { id }, data: { status: "ACTIVE", reservedForId: null } });
        break;
      case "markSold":
        await db.listing.update({ where: { id }, data: { status: "SOLD", soldAt: new Date(), reservedForId: null } });
        break;
      case "delete":
        if (l._count.orderItems > 0) {
          await db.listing.update({ where: { id }, data: { status: "DELETED" } });
        } else {
          await db.listing.delete({ where: { id } });
          await deleteObjects(l.photos.flatMap((p) => PHOTO_WIDTHS.map((w) => `${p.storageKey}-${w}.webp`)), "public").catch(() => {});
        }
        break;
    }
    revalidatePath("/");
    revalidatePath(listingPath(l));
    return { status: op };
  });
}
