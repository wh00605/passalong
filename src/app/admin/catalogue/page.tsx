import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { ActionForm, Field } from "@/components/ui/form";
import { AdminAction } from "../admin-action";
import { addBrandAction, toggleBrandAction, addCategoryAction, updateCategoryAction, addSizeAction, saveParcelAction, addProhibitedTermAction, deleteProhibitedTermAction } from "../actions";

export const metadata = { title: "Catalogue" };

export default async function CataloguePage() {
  const [categories, brands, groups, parcels, terms] = await Promise.all([
    db.category.findMany({ orderBy: { path: "asc" } }),
    db.brand.findMany({ orderBy: { name: "asc" } }),
    db.sizeGroup.findMany({ include: { sizes: { orderBy: { position: "asc" } } }, orderBy: { name: "asc" } }),
    db.parcelSize.findMany({ orderBy: { position: "asc" } }),
    db.prohibitedTerm.findMany({ orderBy: { term: "asc" } }),
  ]);
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-medium">Catalogue</h1>

      <section aria-labelledby="parcel-h" className="space-y-3">
        <h2 id="parcel-h" className="text-xl font-bold">Parcel sizes & postage prices</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {parcels.map((p) => (
            <ActionForm key={p.id} action={saveParcelAction} className="card space-y-2 p-3" submitLabel="Save" submitClassName="btn-secondary btn-sm">
              <input type="hidden" name="id" value={p.id} />
              <p className="font-semibold">{p.name} <span className="font-mono text-xs text-muted">≤{p.maxWeightGrams / 1000}kg</span></p>
              <Field name="price" label="Price (£)" defaultValue={(p.pricePence / 100).toFixed(2)} inputMode="decimal" />
              <p className="text-xs text-muted">Now {formatPence(p.pricePence)}</p>
            </ActionForm>
          ))}
        </div>
      </section>

      <section aria-labelledby="terms-h" className="space-y-3">
        <h2 id="terms-h" className="text-xl font-bold">Prohibited keywords</h2>
        <p className="text-sm text-muted">“Block” stops a listing being published. “Review” sends it to the moderation queue.</p>
        <ActionForm action={addProhibitedTermAction} className="flex flex-wrap items-end gap-2" submitLabel="Save keyword" submitClassName="btn-secondary">
          <Field name="term" label="Word or phrase" required />
          <Field name="severity" label="Severity" options={[{ value: "BLOCK", label: "Block" }, { value: "REVIEW", label: "Review" }]} />
          <Field name="note" label="Note" />
        </ActionForm>
        <ul className="flex flex-wrap gap-2" role="list">
          {terms.map((t) => (
            <li key={t.id} className={`inline-flex items-center gap-1 rounded-none border px-2 py-1 text-sm ${t.severity === "BLOCK" ? "border-danger" : "border-ink/40"}`}>
              {t.term} <span className="font-mono text-[10px]">{t.severity}</span>
              <AdminAction action={deleteProhibitedTermAction.bind(null, t.id)} label="×" className="btn-ghost min-h-6 px-1 text-xs" confirmText={`Remove “${t.term}”?`} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cat-h" className="space-y-3">
        <h2 id="cat-h" className="text-xl font-bold">Categories</h2>
        <ActionForm action={addCategoryAction} className="flex flex-wrap items-end gap-2" submitLabel="Add category" submitClassName="btn-secondary">
          <Field name="parentId" label="Parent" options={[{ value: "", label: "(top level)" }, ...categories.map((c) => ({ value: c.id, label: c.path }))]} />
          <Field name="name" label="Name" required />
          <Field name="sizeGroupId" label="Size group" options={[{ value: "", label: "(inherit)" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
        </ActionForm>
        <div className="max-h-96 overflow-y-auto rounded-none border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Categories</caption>
            <thead className="sticky top-0 bg-brand-600 text-white"><tr className="text-left font-mono text-xs uppercase"><th scope="col" className="px-2 py-1">Path</th><th scope="col">Active</th><th scope="col">Prohibited</th></tr></thead>
            <tbody className="divide-y divide-line">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-2 py-1 font-mono text-xs">{c.path}</td>
                  <td><AdminAction action={updateCategoryAction.bind(null, c.id, { isActive: !c.isActive })} label={c.isActive ? "Yes – disable" : "No – enable"} className="btn-ghost btn-sm text-xs" /></td>
                  <td><AdminAction action={updateCategoryAction.bind(null, c.id, { isProhibited: !c.isProhibited })} label={c.isProhibited ? "Yes – allow" : "No – prohibit"} className="btn-ghost btn-sm text-xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="sizes-h" className="space-y-3">
        <h2 id="sizes-h" className="text-xl font-bold">Sizes</h2>
        <ActionForm action={addSizeAction} className="flex flex-wrap items-end gap-2" submitLabel="Add size" submitClassName="btn-secondary">
          <Field name="groupId" label="Size group" options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          <Field name="label" label="Label" required />
        </ActionForm>
        {groups.map((g) => (
          <p key={g.id} className="text-sm"><strong>{g.name}:</strong> {g.sizes.map((s) => s.label).join(", ")}</p>
        ))}
      </section>

      <section aria-labelledby="brands-h" className="space-y-3">
        <h2 id="brands-h" className="text-xl font-bold">Brands ({brands.length})</h2>
        <ActionForm action={addBrandAction} className="flex flex-wrap items-end gap-2" submitLabel="Add brand" submitClassName="btn-secondary">
          <Field name="name" label="Brand name" required />
        </ActionForm>
        <ul className="flex flex-wrap gap-2" role="list">
          {brands.map((b) => (
            <li key={b.id}>
              <AdminAction action={toggleBrandAction.bind(null, b.id, !b.isActive)} label={`${b.name}${b.isActive ? "" : " (off)"}`} className={`btn btn-sm ${b.isActive ? "bg-surface" : "bg-brand-50 line-through"}`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
