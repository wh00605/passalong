/** Builds the denormalised, lower-cased text that search matches against. */
export function buildSearchText(parts: {
  title: string;
  description: string;
  brand?: string | null;
  categoryNames?: string[];
  colours?: string[];
  material?: string | null;
  size?: string | null;
}): string {
  return [
    parts.title,
    parts.brand ?? "",
    ...(parts.categoryNames ?? []),
    ...(parts.colours ?? []),
    parts.material ?? "",
    parts.size ?? "",
    parts.description,
  ]
    .join(" ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}
