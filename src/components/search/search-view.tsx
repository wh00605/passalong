import Link from "next/link";
import { X } from "lucide-react";
import { searchListings, SORTS, type SearchParams } from "@/lib/listings";
import { getFilterOptions, flattenTree, getCategoryTree, CONDITIONS } from "@/lib/catalogue";
import { toQueryString } from "@/lib/search-params";
import { formatPence } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
import { ListingGrid } from "@/components/listing-grid";
import { SaveSearchButton } from "@/components/search/save-search-button";

export async function SearchView({
  params,
  basePath,
  heading,
  intro,
  fixed = {},
}: {
  params: SearchParams;
  basePath: string;
  heading: string;
  intro?: React.ReactNode;
  /** Filters implied by the page itself (e.g. the category of a category page) – not shown as removable chips. */
  fixed?: Partial<SearchParams>;
}) {
  const [results, opts, tree, user] = await Promise.all([searchListings(params), getFilterOptions(), getCategoryTree(), getCurrentUser()]);
  const cats = flattenTree(tree);
  const currentCat = params.category ? cats.find((c) => c.path === params.category) : undefined;
  const relevantGroups = currentCat?.sizeGroupId
    ? opts.sizeGroups.filter((g) => g.id === currentCat.sizeGroupId || cats.some((c) => c.path.startsWith(currentCat.path) && c.sizeGroupId === g.id))
    : opts.sizeGroups;

  const href = (o: Partial<SearchParams>, omit: (keyof SearchParams)[] = []) => {
    const qs = toQueryString(params, { ...o, page: 1 }, [...omit, ...(Object.keys(fixed) as (keyof SearchParams)[])]);
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const chips: { label: string; href: string }[] = [];
  if (params.q && !fixed.q) chips.push({ label: `“${params.q}”`, href: href({}, ["q"]) });
  if (params.category && !fixed.category && currentCat) chips.push({ label: currentCat.name, href: href({}, ["category"]) });
  for (const id of params.brand ?? []) if (!fixed.brand) chips.push({ label: opts.brands.find((b) => b.id === id)?.name ?? "Brand", href: href({ brand: params.brand!.filter((x) => x !== id) }) });
  for (const id of params.size ?? []) chips.push({ label: opts.sizeGroups.flatMap((g) => g.sizes).find((s) => s.id === id)?.label ?? "Size", href: href({ size: params.size!.filter((x) => x !== id) }) });
  for (const c of params.condition ?? []) chips.push({ label: CONDITIONS.find((x) => x.value === c)?.label ?? c, href: href({ condition: params.condition!.filter((x) => x !== c) }) });
  for (const id of params.colour ?? []) chips.push({ label: opts.colours.find((c) => c.id === id)?.name ?? "Colour", href: href({ colour: params.colour!.filter((x) => x !== id) }) });
  for (const id of params.material ?? []) chips.push({ label: opts.materials.find((m) => m.id === id)?.name ?? "Material", href: href({ material: params.material!.filter((x) => x !== id) }) });
  if (params.priceMin != null) chips.push({ label: `From ${formatPence(params.priceMin)}`, href: href({}, ["priceMin"]) });
  if (params.priceMax != null) chips.push({ label: `Up to ${formatPence(params.priceMax)}`, href: href({}, ["priceMax"]) });

  const hidden = (name: string, values: string[] | string | undefined) =>
    (Array.isArray(values) ? values : values ? [values] : []).map((v) => <input key={`${name}-${v}`} type="hidden" name={name} value={v} />);

  const Group = ({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) => (
    <details open={open} className="group border-b-2 border-line py-2">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">
        {title}
        <span aria-hidden="true" className="font-mono transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="pt-2 pb-3">{children}</div>
    </details>
  );
  const Check = ({ name, value, label, checked }: { name: string; value: string; label: React.ReactNode; checked: boolean }) => (
    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-4 w-4 accent-ink" />
      {label}
    </label>
  );

  const filters = (
    <form method="get" action={basePath} className="space-y-1" aria-label="Filters">
      {params.q && !fixed.q && <input type="hidden" name="q" value={params.q} />}
      {hidden("sort", params.sort)}
      {!fixed.category && (
        <Group title="Category" open={!params.category}>
          <select name="category" defaultValue={params.category ?? ""} className="input" aria-label="Category">
            <option value="">All categories</option>
            {cats.filter((c) => !c.isProhibited).map((c) => (
              <option key={c.id} value={c.path}>{"  ".repeat(c.depth)}{c.name}</option>
            ))}
          </select>
        </Group>
      )}
      {!fixed.brand && (
        <Group title="Brand" open={!!params.brand?.length}>
          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-2">
            {opts.brands.map((b) => <Check key={b.id} name="brand" value={b.id} label={b.name} checked={!!params.brand?.includes(b.id)} />)}
          </div>
        </Group>
      )}
      <Group title="Size" open={!!params.size?.length}>
        <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
          {relevantGroups.map((g) => (
            <fieldset key={g.id}>
              <legend className="eyebrow mb-1">{g.name}</legend>
              <div className="flex flex-wrap gap-x-3">
                {g.sizes.map((s) => <Check key={s.id} name="size" value={s.id} label={s.label} checked={!!params.size?.includes(s.id)} />)}
              </div>
            </fieldset>
          ))}
        </div>
      </Group>
      <Group title="Condition" open={!!params.condition?.length}>
        {CONDITIONS.map((c) => <Check key={c.value} name="condition" value={c.value} label={c.label} checked={!!params.condition?.includes(c.value)} />)}
      </Group>
      <Group title="Colour" open={!!params.colour?.length}>
        <div className="grid grid-cols-2 gap-x-2">
          {opts.colours.map((c) => (
            <Check key={c.id} name="colour" value={c.id} checked={!!params.colour?.includes(c.id)} label={<><span className="h-3.5 w-3.5 rounded-full border border-ink/40" style={{ background: c.hex }} aria-hidden="true" />{c.name}</>} />
          ))}
        </div>
      </Group>
      <Group title="Material" open={!!params.material?.length}>
        <div className="max-h-56 overflow-y-auto pr-2">
          {opts.materials.map((m) => <Check key={m.id} name="material" value={m.id} label={m.name} checked={!!params.material?.includes(m.id)} />)}
        </div>
      </Group>
      <Group title="Price" open={params.priceMin != null || params.priceMax != null}>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="priceMin" className="label text-xs">Min £</label>
            <input id="priceMin" name="priceMin" inputMode="decimal" className="input" defaultValue={params.priceMin != null ? params.priceMin / 100 : ""} />
          </div>
          <div>
            <label htmlFor="priceMax" className="label text-xs">Max £</label>
            <input id="priceMax" name="priceMax" inputMode="decimal" className="input" defaultValue={params.priceMax != null ? params.priceMax / 100 : ""} />
          </div>
        </div>
      </Group>
      <div className="flex gap-2 pt-3">
        <button type="submit" className="btn-primary flex-1">Show results</button>
        <Link href={basePath} className="btn-ghost">Clear</Link>
      </div>
    </form>
  );

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-3">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{heading}</h1>
          <p className="mt-1 font-mono text-sm text-muted" aria-live="polite">{results.total.toLocaleString("en-GB")} item{results.total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user && <SaveSearchButton query={toQueryString(params, {}, ["page", "sort"])} defaultName={heading} />}
          <form method="get" action={basePath} className="flex items-center gap-2">
            {[...new URLSearchParams(toQueryString(params, {}, ["sort", "page", ...(Object.keys(fixed) as (keyof SearchParams)[])])).entries()].map(([k, v], i) => (
              <input key={`${k}${i}`} type="hidden" name={k} value={v} />
            ))}
            <label htmlFor="sort" className="text-sm font-semibold">Sort</label>
            <select id="sort" name="sort" defaultValue={results.sort} className="input w-auto">
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="submit" className="btn-secondary btn-sm">Apply</button>
          </form>
        </div>
      </div>
      {intro}
      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.label + c.href}>
              <Link href={c.href} className="inline-flex min-h-9 items-center gap-1 rounded-full border-2 border-ink bg-accent-400 px-3 text-sm font-semibold">
                {c.label} <X className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(remove filter)</span>
              </Link>
            </li>
          ))}
          <li><Link href={basePath} className="inline-flex min-h-9 items-center px-2 text-sm underline">Clear all</Link></li>
        </ul>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <details className="lg:hidden">
            <summary className="btn-secondary w-full list-none">Filters{chips.length ? ` (${chips.length})` : ""}</summary>
            <div className="mt-3">{filters}</div>
          </details>
          <div className="hidden lg:block">{filters}</div>
        </aside>
        <div>
          <ListingGrid
            listings={results.items}
            empty={
              <>
                No items match these filters yet.{" "}
                {user ? "Save this search and we'll tell you when something turns up." : <Link href="/signup" className="link">Sign up to save searches</Link>}
              </>
            }
          />
          {results.pageCount > 1 && (
            <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-2">
              {results.page > 1 && <Link className="btn-secondary btn-sm" href={`${basePath}?${toQueryString(params, { page: results.page - 1 }, Object.keys(fixed) as (keyof SearchParams)[])}`} rel="prev">Previous</Link>}
              <span className="px-3 font-mono text-sm">Page {results.page} of {results.pageCount}</span>
              {results.page < results.pageCount && <Link className="btn-secondary btn-sm" href={`${basePath}?${toQueryString(params, { page: results.page + 1 }, Object.keys(fixed) as (keyof SearchParams)[])}`} rel="next">Next</Link>}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
