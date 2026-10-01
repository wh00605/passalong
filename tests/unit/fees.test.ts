import { describe, expect, it } from "vitest";
import { buyerProtectionFee, bundleDiscountPercent, minimumOffer, priceWithProtection, quoteOrder } from "@/lib/fees";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

const s = DEFAULT_SETTINGS;

describe("buyerProtectionFee", () => {
  it("is £0.75 + 5% of the item price", () => {
    expect(buyerProtectionFee(1800, s)).toBe(75 + 90); // £18 → £1.65
    expect(buyerProtectionFee(1000, s)).toBe(125);
  });
  it("rounds the percentage half up to the nearest penny", () => {
    expect(buyerProtectionFee(1010, s)).toBe(75 + 51); // 50.5 → 51
    expect(buyerProtectionFee(1009, s)).toBe(75 + 50); // 50.45 → 50
  });
  it("is zero for an empty basket", () => {
    expect(buyerProtectionFee(0, s)).toBe(0);
  });
  it("feeds the headline all-in price", () => {
    expect(priceWithProtection(1800, s)).toBe(1965);
  });
});

describe("bundleDiscountPercent", () => {
  const tiers = [
    { minItems: 2, percentOff: 10 },
    { minItems: 3, percentOff: 15 },
    { minItems: 5, percentOff: 20 },
  ];
  it("picks the best tier the bundle qualifies for", () => {
    expect(bundleDiscountPercent(1, tiers, true)).toBe(0);
    expect(bundleDiscountPercent(2, tiers, true)).toBe(10);
    expect(bundleDiscountPercent(4, tiers, true)).toBe(15);
    expect(bundleDiscountPercent(9, tiers, true)).toBe(20);
  });
  it("is zero when the seller has switched bundles off", () => {
    expect(bundleDiscountPercent(5, tiers, false)).toBe(0);
  });
});

describe("quoteOrder", () => {
  const base = { shippingPence: 449, bundleTiers: [{ minItems: 2, percentOff: 10 }], bundleDiscountsEnabled: true, settings: s };

  it("prices a single item", () => {
    const q = quoteOrder({ ...base, itemPrices: [2000] });
    expect(q).toMatchObject({ itemsSubtotalPence: 2000, bundleDiscountPence: 0, buyerProtectionFeePence: 175, totalPence: 2000 + 449 + 175, sellerEarningsPence: 2000 });
  });

  it("applies bundle discount before the protection fee", () => {
    const q = quoteOrder({ ...base, itemPrices: [2000, 1000] });
    expect(q.bundleDiscountPence).toBe(300);
    expect(q.discountedItemsPence).toBe(2700);
    expect(q.buyerProtectionFeePence).toBe(75 + 135);
    expect(q.totalPence).toBe(2700 + 449 + 210);
    expect(q.sellerEarningsPence).toBe(2700);
  });

  it("uses an accepted offer instead of list prices and bundle discount", () => {
    const q = quoteOrder({ ...base, itemPrices: [2000, 1000], offerPence: 2400 });
    expect(q.bundleDiscountPence).toBe(0);
    expect(q.discountedItemsPence).toBe(2400);
    expect(q.totalPence).toBe(2400 + 449 + 75 + 120);
  });

  it("deducts seller commission when configured", () => {
    const q = quoteOrder({ ...base, itemPrices: [2000], settings: { ...s, sellerCommissionBps: 500 } });
    expect(q.sellerEarningsPence).toBe(1900);
  });
});

describe("minimumOffer", () => {
  it("is 60% of the list price, rounded up", () => {
    expect(minimumOffer(1000, 60)).toBe(600);
    expect(minimumOffer(999, 60)).toBe(600);
  });
});
