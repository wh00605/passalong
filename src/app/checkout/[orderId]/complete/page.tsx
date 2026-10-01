import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "Payment", robots: { index: false } };

export default async function CheckoutComplete({ params, searchParams }: PageProps<"/checkout/[orderId]/complete">) {
  const { orderId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const order = await db.order.findFirst({ where: { id: orderId, buyerId: user.id } });
  if (!order) notFound();
  const failed = sp.redirect_status === "failed";

  if (order.status === "PENDING_PAYMENT" && !failed) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <AutoRefresh />
        <h1 className="text-3xl font-extrabold">Confirming your payment…</h1>
        <p role="status" className="mt-3 text-muted">This usually takes a few seconds. Please don&apos;t pay again.</p>
      </div>
    );
  }
  if (failed || order.status === "CANCELLED") {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <h1 className="text-3xl font-extrabold">Payment didn&apos;t go through</h1>
        <p className="mt-3">{order.cancelReason ?? "Your bank declined the payment or it was cancelled. You haven't been charged."}</p>
        <Link href={`/checkout/${order.id}`} className="btn-primary mt-6">Try again</Link>
      </div>
    );
  }
  return (
    <div className="container-page max-w-lg py-16 text-center">
      <p className="tag mx-auto">PAID</p>
      <h1 className="mt-3 text-4xl font-extrabold">Order confirmed!</h1>
      <p className="mt-3">You paid {formatPence(order.totalPence)}. We&apos;ve told the seller – you&apos;ll get updates as it&apos;s posted and tracked.</p>
      <Link href={`/orders/${order.id}`} className="btn-primary mt-6">View order</Link>
    </div>
  );
}
