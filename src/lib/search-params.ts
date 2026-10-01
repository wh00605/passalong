import { SORTS, type SearchParams, type SortKey } from "@/lib/listings";
import { parsePounds } from "@/lib/money";

type Raw = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean).slice(0, 30);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Parses URL search params into validated search options. Unknown values are ignored. */
export function parseSearchParams(sp: Raw, fixed: Partial<SearchParams> = {}): SearchParams {
  const priceMin = parsePounds(one(sp.priceMin));
  const priceMax = parsePounds(one(sp.priceMax));
  const sort = one(sp.sort);
  return {
    q: one(sp.q).slice(0, 100) || undefined,
    category: one(sp.category) || undefined,
    brand: arr(sp.brand),
    size: arr(sp.size),
    condition: arr(sp.condition).filter((c) => ["NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "VERY_GOOD", "GOOD", "SATISFACTORY"].includes(c)),
    colour: arr(sp.colour),
    material: arr(sp.material),
    priceMin: priceMin ?? undefined,
    priceMax: priceMax ?? undefined,
    sort: sort in SORTS ? (sort as SortKey) : undefined,
    page: Math.max(1, Number(one(sp.page)) || 1),
    ...fixed,
  };
}

/** Serialises search options back into a query string (used for links, pagination and saved searches). */
export function toQueryString(p: SearchParams, overrides: Partial<SearchParams> = {}, omit: (keyof SearchParams)[] = []): string {
  const m = { ...p, ...overrides };
  const qs = new URLSearchParams();
  if (m.q && !omit.includes("q")) qs.set("q", m.q);
  if (m.category && !omit.includes("category")) qs.set("category", m.category);
  for (const k of ["brand", "size", "condition", "colour", "material"] as const) {
    if (!omit.includes(k)) for (const v of m[k] ?? []) qs.append(k, v);
  }
  if (m.priceMin != null && !omit.includes("priceMin")) qs.set("priceMin", (m.priceMin / 100).toString());
  if (m.priceMax != null && !omit.includes("priceMax")) qs.set("priceMax", (m.priceMax / 100).toString());
  if (m.sort && !omit.includes("sort")) qs.set("sort", m.sort);
  if (m.page && m.page > 1 && !omit.includes("page")) qs.set("page", String(m.page));
  return qs.toString();
}
