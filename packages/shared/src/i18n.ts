import { SUPPORTED_CURRENCIES, type CurrencyCode } from "./money";

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "bn"] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const MESSAGES = {
  en: {
    "nav.flights": "Flights",
    "nav.hotels": "Hotels",
    "nav.offers": "Offers",
    "nav.trips": "My Trips",
    "nav.help": "Help",
    "empty.trips": "No trips in this list",
    "empty.offers": "No live campaigns",
  },
  bn: {
    "nav.flights": "ফ্লাইট",
    "nav.hotels": "হোটেল",
    "nav.offers": "অফার",
    "nav.trips": "আমার ভ্রমণ",
    "nav.help": "সাহায্য",
    "empty.trips": "এই তালিকায় কোনো ভ্রমণ নেই",
    "empty.offers": "এখন কোনো ক্যাম্পেইন নেই",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["en"];

export function t(key: MessageKey, locale: string = DEFAULT_LOCALE) {
  const catalog = locale === "bn" ? MESSAGES.bn : MESSAGES.en;
  return catalog[key];
}

export function formatMoney(amount: number, currency: string, locale: string = DEFAULT_LOCALE) {
  const code = (SUPPORTED_CURRENCIES as readonly string[]).includes(currency) ? (currency as CurrencyCode) : "BDT";
  if (code === "BDT") {
    return `৳ ${Math.round(amount).toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;
  }
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
    style: "currency",
    currency: code,
  }).format(amount);
}

export function formatDate(value: string | Date, locale: string = DEFAULT_LOCALE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
