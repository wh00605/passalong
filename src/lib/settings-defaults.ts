// Launch defaults (UK, GBP). Every value is editable by admins at /admin/fees.
// Percentages are basis points: 500 = 5%.

export const DEFAULT_SETTINGS = {
  buyerProtectionFixedPence: 75,
  buyerProtectionPercentBps: 500,
  sellerCommissionBps: 0,
  bumpPricePence: 99,
  bumpDays: 3,
  spotlightPricePence: 599,
  spotlightDays: 7,
  minOfferPercent: 60,
  offerExpiryHours: 48,
  shipByWorkingDays: 5,
  autoReleaseDays: 2,
  disputeWindowDays: 2,
  sellerDisputeResponseDays: 2,
  autoFeedbackDays: 7,
  minWithdrawalPence: 100,
  maxPhotosPerListing: 20,
  maxListingPricePence: 1_000_000,
  minListingPricePence: 100,
  taxReportSalesThreshold: 30,
  taxReportIncomePence: 170_000,
  newAccountHighValuePence: 50_000,
  newAccountDays: 7,
} as const;

type Widen<T> = { -readonly [K in keyof T]: T[K] extends number ? number : T[K] };
export type PlatformSettings = Widen<typeof DEFAULT_SETTINGS>;
