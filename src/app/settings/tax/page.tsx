import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { decrypt, maskTin } from "@/lib/crypto";
import { ActionForm, Field } from "@/components/ui/form";
import { saveTaxProfileAction } from "./actions";

export default async function TaxPage() {
  const user = await requireUser("/settings/tax");
  const p = await db.sellerTaxProfile.findUnique({ where: { userId: user.id } });
  let masked = "";
  try {
    masked = p?.tinEncrypted ? maskTin(decrypt(p.tinEncrypted)) : "";
  } catch {
    masked = "saved";
  }
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-medium">Tax details</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Under the UK&apos;s reporting rules for digital platforms (and the EU&apos;s DAC7), we must report sellers who make 30 or more sales or earn £1,700 or more in a calendar year to HMRC. We only ask once you&apos;re close to that point. Your tax ID is encrypted.
      </p>
      <ActionForm action={saveTaxProfileAction} className="mt-6 max-w-xl space-y-4" submitLabel="Save tax details">
        <Field name="sellerType" label="Selling as" defaultValue={p?.sellerType ?? "INDIVIDUAL"} options={[{ value: "INDIVIDUAL", label: "An individual" }, { value: "BUSINESS", label: "A business" }]} />
        <Field name="legalName" label="Full legal name (or business name)" defaultValue={p?.legalName} required />
        <Field name="dateOfBirth" label="Date of birth (individuals)" type="date" defaultValue={p?.dateOfBirth?.toISOString().slice(0, 10)} />
        <Field name="tin" label="National Insurance number or UTR" hint={masked ? `Saved: ${masked}. Leave blank to keep it.` : "e.g. QQ123456C or a 10-digit UTR."} autoComplete="off" />
        <Field name="companyNumber" label="Company number (businesses)" defaultValue={p?.companyNumber ?? ""} />
        <Field name="addressLine1" label="Address line 1" defaultValue={p?.addressLine1} autoComplete="address-line1" required />
        <Field name="addressLine2" label="Address line 2" defaultValue={p?.addressLine2 ?? ""} autoComplete="address-line2" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="city" label="Town or city" defaultValue={p?.city} autoComplete="address-level2" required />
          <Field name="postcode" label="Postcode" defaultValue={p?.postcode} autoComplete="postal-code" required />
        </div>
      </ActionForm>
    </section>
  );
}
