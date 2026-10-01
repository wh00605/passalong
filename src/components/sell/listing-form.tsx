"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { initialActionState } from "@/lib/action-types";
import { FormMessage } from "@/components/ui/form";
import { PhotoUploader, type UploadedPhoto } from "@/components/sell/photo-uploader";
import { saveListingAction } from "@/app/actions/listings";
import { CONDITIONS } from "@/lib/conditions";
import { formatPence, parsePounds } from "@/lib/money";
import { buyerProtectionFee } from "@/lib/fees";

type Cat = { id: string; name: string; sizeGroupId: string | null; isProhibited: boolean; children: Cat[] };

export type ListingFormProps = {
  initial?: {
    id: string; title: string; description: string; categoryId: string | null; brandId: string | null; brandName: string | null;
    customBrand: string | null; sizeId: string | null; condition: string | null; colourIds: string[]; materialId: string | null;
    pricePence: number; parcelSizeId: string | null; status: string; photos: UploadedPhoto[];
  };
  tree: Cat[];
  sizeGroups: { id: string; sizes: { id: string; label: string }[] }[];
  brands: { id: string; name: string }[];
  colours: { id: string; name: string; hex: string }[];
  materials: { id: string; name: string }[];
  parcels: { id: string; name: string; description: string; pricePence: number }[];
  fees: { buyerProtectionFixedPence: number; buyerProtectionPercentBps: number; sellerCommissionBps: number };
  maxPhotos: number;
};

function ErrorText({ id, msg }: { id: string; msg?: string[] }) {
  return msg?.length ? <p id={id} className="mt-1 text-sm font-medium text-danger">{msg[0]}</p> : null;
}

function Buttons({ isDraft }: { isDraft: boolean }) {
  const { pending, data } = useFormStatus();
  const intent = data?.get("intent");
  return (
    <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap justify-end gap-2 border-t-2 border-ink bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
      {isDraft && (
        <button type="submit" name="intent" value="draft" className="btn-secondary" disabled={pending}>
          {pending && intent === "draft" ? "Saving…" : "Save draft"}
        </button>
      )}
      <button type="submit" name="intent" value="publish" className="btn-accent min-w-40" disabled={pending}>
        {pending && intent === "publish" ? "Publishing…" : isDraft ? "Publish item" : "Save changes"}
      </button>
    </div>
  );
}

function findPath(tree: Cat[], id: string | null): Cat[] {
  if (!id) return [];
  for (const n of tree) {
    if (n.id === id) return [n];
    const sub = findPath(n.children, id);
    if (sub.length) return [n, ...sub];
  }
  return [];
}

export function ListingForm(p: ListingFormProps) {
  const [state, action] = useActionState(saveListingAction, initialActionState);
  const router = useRouter();
  const fe = state.fieldErrors ?? {};
  const init = p.initial;

  const [path, setPath] = useState<Cat[]>(() => findPath(p.tree, init?.categoryId ?? null));
  const leaf = path.at(-1);
  const isLeaf = !!leaf && leaf.children.length === 0;
  const sizeGroupId = [...path].reverse().find((c) => c.sizeGroupId)?.sizeGroupId ?? null;
  const sizes = p.sizeGroups.find((g) => g.id === sizeGroupId)?.sizes ?? [];

  const [brandText, setBrandText] = useState(init?.brandName ?? init?.customBrand ?? "");
  const brandMatch = useMemo(() => p.brands.find((b) => b.name.toLowerCase() === brandText.trim().toLowerCase()), [brandText, p.brands]);

  const [colours, setColours] = useState<string[]>(init?.colourIds ?? []);
  const [price, setPrice] = useState(init && init.pricePence ? (init.pricePence / 100).toFixed(2) : "");
  const pricePence = parsePounds(price);
  const [title, setTitle] = useState(init?.title ?? "");
  const [desc, setDesc] = useState(init?.description ?? "");

  useEffect(() => {
    if (state.ok && state.data?.next) router.push(state.data.next as string);
    else if (state.ok && state.data?.id && !init) router.replace(`/items/${state.data.id}/edit`);
  }, [state, router, init]);

  const isDraft = !init || init.status === "DRAFT";
  const levels: Cat[][] = [p.tree, ...path.filter((c) => c.children.length).map((c) => c.children)];

  return (
    <form action={action} className="space-y-10" noValidate>
      {init && <input type="hidden" name="listingId" value={init.id} />}
      <FormMessage state={state} />

      <section className="card p-5 sm:p-6">
        <PhotoUploader initial={init?.photos ?? []} max={p.maxPhotos} error={fe.photos?.[0]} />
      </section>

      <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="about-h">
        <h2 id="about-h" className="text-lg font-bold">About the item</h2>
        <div>
          <label htmlFor="title" className="label">Title</label>
          <input id="title" name="title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Levi's 501 straight jeans" aria-invalid={!!fe.title} aria-describedby="title-count title-err" />
          <p id="title-count" className="mt-1 text-right font-mono text-xs text-muted">{title.length}/80</p>
          <ErrorText id="title-err" msg={fe.title} />
        </div>
        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" name="description" rows={5} className="input" maxLength={2000} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Fit, measurements, any flaws, why you're selling…" aria-invalid={!!fe.description} aria-describedby="desc-count desc-err" />
          <p id="desc-count" className="mt-1 text-right font-mono text-xs text-muted">{desc.length}/2000</p>
          <ErrorText id="desc-err" msg={fe.description} />
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="details-h">
        <h2 id="details-h" className="text-lg font-bold">Details</h2>
        <fieldset aria-describedby="cat-err">
          <legend className="label">Category</legend>
          <input type="hidden" name="categoryId" value={isLeaf ? leaf!.id : leaf?.id ?? ""} />
          <div className="grid gap-2 sm:grid-cols-3">
            {levels.map((options, depth) => (
              <select
                key={depth}
                aria-label={depth === 0 ? "Department" : `Category level ${depth + 1}`}
                className="input"
                value={path[depth]?.id ?? ""}
                aria-invalid={!!fe.categoryId}
                onChange={(e) => {
                  const chosen = options.find((o) => o.id === e.target.value);
                  setPath([...path.slice(0, depth), ...(chosen ? [chosen] : [])]);
                }}
              >
                <option value="">Choose…</option>
                {options.filter((o) => !o.isProhibited).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            ))}
          </div>
          <ErrorText id="cat-err" msg={fe.categoryId} />
        </fieldset>

        <div>
          <label htmlFor="brand" className="label">Brand</label>
          <input id="brand" list="brand-list" className="input" value={brandText} onChange={(e) => setBrandText(e.target.value)} placeholder="Start typing, or leave blank if unbranded" autoComplete="off" aria-describedby="brand-hint" />
          <datalist id="brand-list">
            {p.brands.map((b) => <option key={b.id} value={b.name} />)}
          </datalist>
          <input type="hidden" name="brandId" value={brandMatch?.id ?? ""} />
          <input type="hidden" name="customBrand" value={brandMatch ? "" : brandText.trim()} />
          <p id="brand-hint" className="hint">
            {brandText && !brandMatch ? <>“{brandText.trim()}” will be added as a custom brand.</> : "Pick from the list or type your own."}
          </p>
        </div>

        {sizes.length > 0 && (
          <div>
            <label htmlFor="sizeId" className="label">Size</label>
            <select id="sizeId" name="sizeId" className="input" defaultValue={init?.sizeId ?? ""} aria-invalid={!!fe.sizeId} aria-describedby="size-err">
              <option value="">Choose a size…</option>
              {sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ErrorText id="size-err" msg={fe.sizeId} />
          </div>
        )}

        <fieldset aria-describedby="cond-err">
          <legend className="label">Condition</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CONDITIONS.map((c) => (
              <label key={c.value} className="relative cursor-pointer">
                <input type="radio" name="condition" value={c.value} defaultChecked={init?.condition === c.value} className="peer sr-only" />
                <span className="block h-full rounded-md border-2 border-ink/30 bg-surface p-3 peer-checked:border-ink peer-checked:bg-accent-400 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:border-ink">
                  <span className="block font-semibold">{c.label}</span>
                  <span className="text-sm text-muted peer-checked:text-ink">{c.description}</span>
                </span>
              </label>
            ))}
          </div>
          <ErrorText id="cond-err" msg={fe.condition} />
        </fieldset>

        <fieldset>
          <legend className="label">Colour <span className="font-normal text-muted">(up to 2)</span></legend>
          <div className="flex flex-wrap gap-2">
            {p.colours.map((c) => {
              const on = colours.includes(c.id);
              return (
                <label key={c.id} className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    name="colourIds"
                    value={c.id}
                    checked={on}
                    disabled={!on && colours.length >= 2}
                    onChange={() => setColours(on ? colours.filter((x) => x !== c.id) : [...colours, c.id])}
                    className="peer sr-only"
                  />
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-md border-2 border-ink/30 bg-surface px-3 text-sm peer-checked:border-ink peer-checked:bg-accent-400 peer-disabled:opacity-40 peer-focus-visible:outline-3 peer-focus-visible:outline-ink hover:border-ink">
                    <span className="h-4 w-4 rounded-full border border-ink/40" style={{ background: c.hex }} aria-hidden="true" />
                    {c.name}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="materialId" className="label">Material <span className="font-normal text-muted">(optional)</span></label>
          <select id="materialId" name="materialId" className="input sm:max-w-xs" defaultValue={init?.materialId ?? ""}>
            <option value="">Not specified</option>
            {p.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="price-h">
        <h2 id="price-h" className="text-lg font-bold">Price & postage</h2>
        <div>
          <label htmlFor="price" className="label">Price</label>
          <div className="relative sm:max-w-xs">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono font-bold" aria-hidden="true">£</span>
            <input id="price" name="price" inputMode="decimal" className="input pl-7 font-mono text-lg" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" aria-invalid={!!fe.price} aria-describedby="price-sum price-err" />
          </div>
          <ErrorText id="price-err" msg={fe.price} />
          <p id="price-sum" className="mt-2 text-sm text-muted" aria-live="polite">
            {pricePence ? (
              <>
                You receive <strong className="text-ink">{formatPence(pricePence - Math.round((pricePence * p.fees.sellerCommissionBps) / 10_000))}</strong>.
                Buyers pay {formatPence(pricePence + buyerProtectionFee(pricePence, p.fees))} including Buyer Protection, plus postage.
              </>
            ) : (
              "Tip: check what similar items sold for."
            )}
          </p>
        </div>
        <fieldset aria-describedby="parcel-err">
          <legend className="label">Parcel size</legend>
          <p className="hint mb-2">The buyer pays postage. We&apos;ll generate a prepaid label when it sells.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {p.parcels.map((ps) => (
              <label key={ps.id} className="relative cursor-pointer">
                <input type="radio" name="parcelSizeId" value={ps.id} defaultChecked={init?.parcelSizeId === ps.id} className="peer sr-only" />
                <span className="flex h-full flex-col rounded-md border-2 border-ink/30 bg-surface p-3 peer-checked:border-ink peer-checked:bg-accent-400 peer-focus-visible:outline-3 peer-focus-visible:outline-ink hover:border-ink">
                  <span className="flex items-baseline justify-between">
                    <span className="font-semibold">{ps.name}</span>
                    <span className="font-mono text-sm">{formatPence(ps.pricePence)}</span>
                  </span>
                  <span className="mt-1 text-sm text-muted">{ps.description}</span>
                </span>
              </label>
            ))}
          </div>
          <ErrorText id="parcel-err" msg={fe.parcelSizeId} />
        </fieldset>
      </section>

      <p className="text-sm text-muted">
        By publishing you confirm the item follows our <Link href="/legal/catalogue-rules" className="link">catalogue rules</Link> and isn&apos;t on the{" "}
        <Link href="/legal/prohibited-items" className="link">prohibited items list</Link>.
      </p>
      <Buttons isDraft={isDraft} />
    </form>
  );
}
