export const SUPPORTED_CURRENCIES = [
  "BDT",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SAR",
  "INR",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  BDT: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SAR: 2,
  INR: 2,
};

export type Money = {
  amount: string;
  currency: CurrencyCode;
};

/** Convert a major-unit amount to integer minor units (cents). Avoids float drift. */
export function toCents(amount: number | string): number {
  const [whole, fraction = ""] = String(amount).split(".");
  const frac = (fraction + "00").slice(0, 2);
  const sign = String(amount).trim().startsWith("-") ? -1 : 1;
  const absWhole = whole.replace("-", "") || "0";
  return sign * (Number(absWhole) * 100 + Number(frac));
}

export function fromCents(cents: number): number {
  return Math.trunc(cents) / 100;
}

export function addCents(...values: number[]): number {
  return values.reduce((sum, value) => sum + Math.trunc(value), 0);
}
