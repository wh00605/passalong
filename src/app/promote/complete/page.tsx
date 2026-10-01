import Link from "next/link";

export const metadata = { title: "Promotion", robots: { index: false } };

export default async function PromoteComplete({ searchParams }: PageProps<"/promote/complete">) {
  const sp = await searchParams;
  const failed = sp.redirect_status === "failed";
  return (
    <div className="container-page max-w-lg py-16 text-center">
      <h1 className="text-4xl font-extrabold">{failed ? "Payment didn't go through" : "Thanks – you're boosted!"}</h1>
      <p className="mt-3">{failed ? "You haven't been charged." : "Your promotion starts as soon as the payment is confirmed (usually within seconds). We'll send you a notification."}</p>
      <Link href="/drafts?status=ACTIVE" className="btn-primary mt-6">My items</Link>
    </div>
  );
}
