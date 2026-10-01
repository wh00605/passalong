// Pure pricing functions. Unit tested in tests/unit/fees.test.ts.
import { percentOf } from "@/lib/money";
import type { PlatformSettings } from "@/lib/settings-defaults";

type FeeSettings = Pick<PlatformSettings, "buyerProtectionFixedPence" | "buyerProtectionPercentBps">;

/** Buyer Protection fee = fixed fee + percentage of the (discounted) item subtotal. */
export function buyerProtectionFee(itemsPence: number, s: FeeSettings): number {
  if (itemsPence <= 0) return 0;
  return s.buyerProtectionFixedPence + percentOf(itemsPence, s.buyerProtectionPercentBps);
}

/** Item price including the mandatory Buyer Protection fee (shown as the headline price – DMCC Act 2024). */
export function priceWithProtection(pricePence: number, s: FeeSettings): number {
  return pricePence + buyerProtectionFee(pricePence, s);
}

export type BundleTier = { minItems: number; percentOff: number };

/** Highest applicable bundle discount percentage for a number of items. */
export function bundleDiscountPercent(itemCount: number, tiers: BundleTier[], enabled: boolean): number {
  if (!enabled || itemCount < 2) return 0;
  return tiers
    .filter((t) => itemCount >= t.minItems)
    .reduce((best, t) => Math.max(best, t.percentOff), 0);
}

export type OrderQuoteInput = {
  itemPrices: number[];
  /** Agreed offer amount for the whole set of items, if an offer was accepted. Replaces item prices and bundle discount. */
  offerPence?: number | null;
  shippingPence: number;
  bundleTiers: BundleTier[];
  bundleDiscountsEnabled: boolean;
  settings: FeeSettings & Pick<PlatformSettings, "sellerCommissionBps">;
};

export type OrderQuote = {
  itemsSubtotalPence: number;
  bundleDiscountPence: number;
  discountedItemsPence: number;
  shippingPence: number;
  buyerProtectionFeePence: number;
  totalPence: number;
  sellerEarningsPence: number;
  bundleDiscountPercent: number;
};

export function quoteOrder(input: OrderQuoteInput): OrderQuote {
  const itemsSubtotalPence = input.itemPrices.reduce((a, b) => a + b, 0);
  let bundleDiscountPence = 0;
  let pct = 0;
  let discountedItemsPence: number;

  if (input.offerPence != null) {
    discountedItemsPence = input.offerPence;
    bundleDiscountPence = 0;
  } else {
    pct = bundleDiscountPercent(input.itemPrices.length, input.bundleTiers, input.bundleDiscountsEnabled);
    bundleDiscountPence = percentOf(itemsSubtotalPence, pct * 100);
    discountedItemsPence = itemsSubtotalPence - bundleDiscountPence;
  }

  const buyerProtectionFeePence = buyerProtectionFee(discountedItemsPence, input.settings);
  const totalPence = discountedItemsPence + input.shippingPence + buyerProtectionFeePence;
  const commission = percentOf(discountedItemsPence, input.settings.sellerCommissionBps);
  return {
    itemsSubtotalPence,
    bundleDiscountPence,
    discountedItemsPence,
    shippingPence: input.shippingPence,
    buyerProtectionFeePence,
    totalPence,
    // Seller receives the item price (after discounts) minus any commission. Shipping pays for the label.
    sellerEarningsPence: discountedItemsPence - commission,
    bundleDiscountPercent: pct,
  };
}

/** Minimum acceptable offer for a set of items. */
export function minimumOffer(listPricePence: number, minOfferPercent: number): number {
  return Math.ceil((listPricePence * minOfferPercent) / 100);
}
