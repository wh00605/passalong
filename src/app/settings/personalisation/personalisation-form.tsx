"use client";
import { useState } from "react";
import { ActionForm } from "@/components/ui/form";
import { savePersonalisationAction } from "../actions";

export function Chip({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:border-ink">
        {label}
      </span>
    </label>
  );
}

export function PersonalisationForm({
  sizeGroups,
  brands,
  selectedSizes,
  selectedBrands,
  next,
}: {
  sizeGroups: { id: string; name: string; sizes: { id: string; label: string }[] }[];
  brands: { id: string; name: string }[];
  selectedSizes: string[];
  selectedBrands: string[];
  next?: string;
}) {
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  return (
    <ActionForm action={savePersonalisationAction} className="mt-6 space-y-8" submitLabel="Save preferences" redirectOnOk={next}>
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset>
        <legend className="text-lg font-bold">Your sizes</legend>
        <div className="mt-3 space-y-5">
          {sizeGroups.map((g) => (
            <fieldset key={g.id}>
              <legend className="eyebrow mb-2">{g.name}</legend>
              <div className="flex flex-wrap gap-2">
                {g.sizes.map((s) => (
                  <Chip key={s.id} name="sizeIds" value={s.id} label={s.label} defaultChecked={selectedSizes.includes(s.id)} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-lg font-bold">Favourite brands</legend>
        <label htmlFor="brand-filter" className="label mt-3">Filter brands</label>
        <input id="brand-filter" type="search" className="input max-w-sm" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. Nike" />
        <div className="mt-3 flex flex-wrap gap-2">
          {brands.map((b) => (
            <span key={b.id} hidden={!!f && !b.name.toLowerCase().includes(f) && !selectedBrands.includes(b.id)}>
              <Chip name="brandIds" value={b.id} label={b.name} defaultChecked={selectedBrands.includes(b.id)} />
            </span>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}
