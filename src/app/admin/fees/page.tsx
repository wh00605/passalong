import { requireAdmin } from "@/lib/session";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { ActionForm, Field } from "@/components/ui/form";
import { saveSettingsAction } from "../actions";

export const metadata = { title: "Fees & policies" };

const META: Record<keyof typeof DEFAULT_SETTINGS, [string, string]> = {
  buyerProtectionFixedPence: ["Buyer Protection – fixed (pence)", "Added to every order"],
  buyerProtectionPercentBps: ["Buyer Protection – percentage (basis points)", "500 = 5% of item price"],
  sellerCommissionBps: ["Seller commission (basis points)", "0 = no selling fee"],
  bumpPricePence: ["Bump price (pence)", ""],
  bumpDays: ["Bump length (days)", ""],
  spotlightPricePence: ["Wardrobe spotlight price (pence)", ""],
  spotlightDays: ["Wardrobe spotlight length (days)", ""],
  minOfferPercent: ["Minimum offer (% of price)", ""],
  offerExpiryHours: ["Offer expiry (hours)", "Also how long an accepted offer is held"],
  shipByWorkingDays: ["Seller must post within (working days)", "Then auto-cancelled and refunded"],
  autoReleaseDays: ["Auto-release after delivery (days)", ""],
  disputeWindowDays: ["Problem-reporting window (days after delivery)", ""],
  sellerDisputeResponseDays: ["Seller must respond to a problem within (days)", "Then escalated to support"],
  autoFeedbackDays: ["Automatic feedback after (days)", ""],
  minWithdrawalPence: ["Minimum withdrawal (pence)", ""],
  maxPhotosPerListing: ["Max photos per listing", ""],
  maxListingPricePence: ["Max listing price (pence)", ""],
  minListingPricePence: ["Min listing price (pence)", ""],
  taxReportSalesThreshold: ["Tax reporting: sales per year", "HMRC/DAC7 threshold – check with your accountant before changing"],
  taxReportIncomePence: ["Tax reporting: income per year (pence)", "HMRC/DAC7 threshold – check with your accountant before changing"],
  newAccountHighValuePence: ["Fraud: high-value threshold for new accounts (pence)", "Listings above this from new accounts are held for review"],
  newAccountDays: ["Fraud: an account counts as new for (days)", ""],
};

export default async function FeesPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">Fees & policies</h1>
      <p className="max-w-2xl text-sm text-muted">Changes apply immediately to new orders and listings, and every change is recorded in the audit log. Update the help centre and legal pages if you change customer-facing terms.</p>
      <ActionForm action={saveSettingsAction} className="grid max-w-3xl gap-4 sm:grid-cols-2" submitLabel="Save settings">
        {(Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]).map((k) => (
          <Field key={k} name={k} label={META[k][0]} hint={META[k][1] || undefined} type="number" min={0} step={1} defaultValue={String(s[k])} />
        ))}
      </ActionForm>
    </div>
  );
}
