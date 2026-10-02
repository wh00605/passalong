import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "About us", description: "Passalong is a UK marketplace for pre-loved fashion and more.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <p className="eyebrow">About</p>
      <h1 className="mt-2 text-5xl font-semibold leading-[0.95] sm:text-6xl">
        Good stuff deserves a <span className="bg-accent-400 px-1">second round.</span>
      </h1>
      <div className="mt-8 space-y-4 text-lg">
        <p>Passalong is a UK marketplace for pre-loved clothes, shoes, homeware, books, games and more. We built it for everyone – from people clearing out a wardrobe once a year to resellers running a stockroom.</p>
        <p>Sellers keep 100% of their sale price. Buyers get Buyer Protection on every order. And every item that finds a second home is one less thing in landfill.</p>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/sell" className="btn-accent">Start selling</Link>
        <Link href="/help" className="btn-secondary">Help centre</Link>
      </div>
    </div>
  );
}
