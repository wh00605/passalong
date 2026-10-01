import type { Metadata } from "next";
import { db } from "@/lib/db";
import { DraftBanner } from "../draft-banner";

export const metadata: Metadata = { title: "Prohibited items", description: "Items you can't sell on Passalong.", alternates: { canonical: "/legal/prohibited-items" } };
export const revalidate = 3600;

const GROUPS: [string, string[]][] = [
  ["Weapons", ["Firearms, air guns, ammunition and replicas", "Knives and bladed articles (kitchen knives need age checks we don't yet support)", "Pepper spray, tasers and other self-defence weapons"]],
  ["Drugs, tobacco and alcohol", ["Illegal drugs, psychoactive substances and paraphernalia", "Tobacco, vapes and e-liquids", "Alcohol"]],
  ["Health and hygiene", ["Medicines and prescription items", "Used underwear, used swimwear without hygiene liner, breast milk", "Opened cosmetics and beauty products", "Used car seats and cycle helmets"]],
  ["Counterfeit and infringing", ["Counterfeit or replica goods, and listings “inspired by” a brand", "Pirated media, software keys and account sharing"]],
  ["Animals and wildlife", ["Live animals", "Ivory, protected species and products made from them"]],
  ["Financial and documents", ["Gift cards, vouchers and event tickets", "Money, crypto, and financial instruments", "Passports, ID, driving licences and official documents"]],
  ["Other", ["Recalled products", "Adult items", "Stolen goods", "Items you don't have in your possession in the UK"]],
];

export default async function ProhibitedItemsPage() {
  const categories = await db.category.findMany({ where: { isProhibited: true }, select: { path: true, name: true } });
  return (
    <div className="container-page max-w-3xl py-10">
      <DraftBanner />
      <p className="eyebrow mt-6">Legal</p>
      <h1 className="mt-2 text-4xl font-medium sm:text-5xl">Prohibited items</h1>
      <p className="mt-3">These items can&apos;t be sold on Passalong. We check listings automatically when they&apos;re published, and our team reviews reports. Listing prohibited items can lead to your account being suspended.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {GROUPS.map(([title, items]) => (
          <section key={title} className="card p-5" aria-labelledby={`g-${title}`}>
            <h2 id={`g-${title}`} className="text-lg font-medium">{title}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
      </div>
      {categories.length > 0 && (
        <p className="mt-6 text-sm">Blocked categories: {categories.map((c) => c.path.replace(/\//g, " › ")).join(", ")}.</p>
      )}
    </div>
  );
}
