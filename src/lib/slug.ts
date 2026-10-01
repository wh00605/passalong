export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function listingPath(listing: { id: string; title: string }) {
  return `/items/${listing.id}-${slugify(listing.title) || "item"}`;
}

/** Extracts the id from "/items/{id}-{slug}". cuid ids never contain hyphens. */
export function listingIdFromParam(param: string): string {
  return param.split("-")[0];
}
