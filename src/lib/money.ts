// All money is integer pence. These helpers are pure so they can be unit tested.

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatPence(pence: number): string {
  return gbp.format(pence / 100);
}

/** Parses "12.50", "£12.5", "12" into pence. Returns null for invalid input. */
export function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Round half up to the nearest penny for basis-point percentages. */
export function percentOf(pence: number, basisPoints: number): number {
  return Math.round((pence * basisPoints) / 10_000);
}
