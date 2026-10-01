import type { Metadata } from "next";
import { ActionForm, Field } from "@/components/ui/form";
import { illegalContentAction } from "./actions";

export const metadata: Metadata = { title: "Report illegal content", alternates: { canonical: "/report-illegal-content" } };

export default function ReportIllegalContentPage() {
  return (
    <div className="container-page max-w-2xl py-10">
      <p className="eyebrow">Notice and action</p>
      <h1 className="mt-2 text-4xl font-extrabold">Report illegal content</h1>
      <p className="mt-3 text-muted">
        Use this form to tell us about content on Passalong you believe is illegal – for example counterfeit goods, stolen items, or illegal weapons. You don&apos;t need an account. We review every notice, act promptly, and email you our decision.
        For rule-breaking that isn&apos;t illegal, use the “Report” button on the item or profile instead.
      </p>
      <ActionForm action={illegalContentAction} className="mt-8 space-y-4" submitLabel="Submit notice">
        <Field name="contentUrl" label="Link to the content" type="url" placeholder="https://passalong.co.uk/items/…" required hint="The exact web address of the item, profile or other content." />
        <Field name="legalBasis" label="Which law do you think it breaks?" required hint="e.g. Trade Marks Act 1994 (counterfeit), Offensive Weapons Act 2019." />
        <Field name="explanation" label="Why is it illegal?" textarea rows={5} maxLength={4000} required hint="Explain clearly why you believe this content is illegal, with any supporting detail." />
        <Field name="reporterName" label="Your name" autoComplete="name" required />
        <Field name="reporterEmail" label="Your email" type="email" autoComplete="email" required />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="goodFaith" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
          I confirm, in good faith, that the information in this notice is accurate and complete.
        </label>
      </ActionForm>
      <p className="mt-6 text-xs text-muted">
        If you are reporting child sexual abuse material, please also report it to the Internet Watch Foundation (iwf.org.uk). If someone is in immediate danger, call 999.
      </p>
    </div>
  );
}
