import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/ui/form";
import { Toggle } from "@/components/ui/toggle";
import { saveBundlesAction } from "../actions";

export default async function BundlesPage() {
  const user = await requireUser();
  const tiers = await db.bundleDiscountTier.findMany({ where: { sellerId: user.id } });
  const pct = (n: number) => tiers.find((t) => t.minItems === n)?.percentOff ?? 0;
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-extrabold">Bundle discounts</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Reward buyers who buy more than one item from you. The discount is applied automatically at checkout to the item prices (not postage).
      </p>
      <ActionForm action={saveBundlesAction} className="mt-6 max-w-xl space-y-6" submitLabel="Save bundle discounts">
        <div className="card px-4">
          <Toggle name="enabled" label="Offer bundle discounts" defaultChecked={user.bundleDiscountsEnabled} />
        </div>
        <fieldset className="card divide-y divide-line">
          <legend className="sr-only">Discount tiers</legend>
          {[2, 3, 5].map((n) => (
            <div key={n} className="flex items-center justify-between gap-4 p-4">
              <label htmlFor={`tier${n}`} className="font-semibold">{n}+ items</label>
              <span className="flex items-center gap-2">
                <select id={`tier${n}`} name={`tier${n}`} defaultValue={pct(n)} className="input w-28">
                  {[0, 5, 10, 15, 20, 25, 30, 40, 50].map((v) => (
                    <option key={v} value={v}>{v === 0 ? "None" : `${v}% off`}</option>
                  ))}
                </select>
              </span>
            </div>
          ))}
        </fieldset>
      </ActionForm>
    </section>
  );
}
