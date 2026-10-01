import Link from "next/link";

export const metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutError({ searchParams }: PageProps<"/checkout/error">) {
  const sp = await searchParams;
  const message = typeof sp.message === "string" ? sp.message.slice(0, 200) : "Something went wrong starting checkout.";
  return (
    <div className="container-page max-w-lg py-16 text-center">
      <h1 className="text-3xl font-extrabold">We couldn&apos;t start checkout</h1>
      <p role="alert" className="mt-3">{message}</p>
      <Link href="/" className="btn-primary mt-6">Keep browsing</Link>
    </div>
  );
}
