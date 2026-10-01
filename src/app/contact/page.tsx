import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { ActionForm, Field } from "@/components/ui/form";
import { contactAction } from "./actions";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact" } };

const TOPICS = ["An order", "Payments or refunds", "My account", "Report a safety concern", "Appeal a decision", "Press or partnerships", "Something else"];

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="text-5xl font-extrabold">Contact us</h1>
      <p className="mt-2 text-muted">We reply within 2 working days. For anything urgent about an order, message the other member first – many problems are sorted in minutes.</p>
      <ActionForm action={contactAction} className="mt-8 space-y-4" submitLabel="Send message">
        <Field name="name" label="Your name" defaultValue={user?.name} autoComplete="name" required />
        <Field name="email" label="Email" type="email" defaultValue={user?.email} autoComplete="email" required />
        <Field name="topic" label="Topic" options={TOPICS.map((t) => ({ value: t, label: t }))} />
        <Field name="orderNumber" label="Order number (if relevant)" placeholder="PA-XXXXXXXX" />
        <Field name="message" label="How can we help?" textarea rows={6} maxLength={4000} required />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </ActionForm>
    </div>
  );
}
