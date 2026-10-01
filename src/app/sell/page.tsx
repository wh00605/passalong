import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ListingForm } from "@/components/sell/listing-form";
import { loadListingFormData } from "@/components/sell/load-form-data";

export const metadata: Metadata = { title: "Sell an item", robots: { index: false } };

export default async function SellPage() {
  const user = await requireUser("/sell");
  const data = await loadListingFormData();
  return (
    <div className="container-page max-w-3xl py-8">
      <p className="eyebrow">New listing</p>
      <h1 className="mt-1 text-4xl font-medium">Sell an item</h1>
      {!user.emailVerified ? (
        <p className="mt-6 rounded-none border border-line bg-accent-300 p-4">
          Please confirm your email address before listing. <Link href="/verify-email" className="link">Resend the link</Link>
        </p>
      ) : (
        <div className="mt-6">
          <ListingForm {...data} />
        </div>
      )}
    </div>
  );
}
