import type { CommissionRule, MarkupRule, ServiceFeeRule } from "@onetrips/database";
import { calculateCustomerPrice } from "./calculate";
import type { FareQuote, FareQuoteInput, PricableOffer, QuoteContext } from "./types";

export type PricingCatalog = {
  markups: MarkupRule[];
  fees: ServiceFeeRule[];
  commissions: CommissionRule[];
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function applyValue(type: "FLAT" | "PERCENT", value: number, base: number) {
  if (type === "PERCENT") return roundMoney(base * (Number(value) / 100));
  return roundMoney(Number(value));
}

export function formatMoneyLabel(currency: string, amount: number) {
  if (currency === "BDT") return `৳ ${Math.round(amount).toLocaleString("en-US")}`;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function inWindow(now: Date, from: Date | null, to: Date | null) {
  if (from && now < from) return false;
  if (to && now > to) return false;
  return true;
}

function markupScore(rule: MarkupRule, input: FareQuoteInput, now: Date): number | null {
  if (rule.status !== "ACTIVE") return null;
  if (!inWindow(now, rule.validFrom, rule.validTo)) return null;
  if (rule.currency && input.currency && rule.currency !== input.currency) return null;
  if (rule.organizationId && rule.organizationId !== input.organizationId) return null;
  if (rule.appliesTo === "ORGANIZATION") {
    if (!input.organizationId || rule.organizationId !== input.organizationId) return null;
  } else if (rule.appliesTo !== input.audience) {
    return null;
  }
  if (rule.airlineCode && rule.airlineCode !== input.airlineCode) return null;
  if (rule.routeOrigin && rule.routeOrigin !== input.origin) return null;
  if (rule.routeDest && rule.routeDest !== input.destination) return null;
  if (rule.cabin && rule.cabin !== input.cabin) return null;
  if (rule.supplierId && rule.supplierId !== input.supplierId) return null;

  let score = 1 + rule.priority;
  if (rule.organizationId) score += 50;
  if (rule.airlineCode) score += 20;
  if (rule.routeOrigin) score += 10;
  if (rule.routeDest) score += 10;
  if (rule.cabin) score += 8;
  if (rule.supplierId) score += 5;
  return score;
}

function pickMarkup(rules: MarkupRule[], input: FareQuoteInput, now: Date) {
  let best: MarkupRule | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    const score = markupScore(rule, input, now);
    if (score === null || score < bestScore) continue;
    best = rule;
    bestScore = score;
  }
  return best;
}

function matchingFees(rules: ServiceFeeRule[], input: FareQuoteInput) {
  return rules.filter((rule) => {
    if (rule.status !== "ACTIVE") return false;
    if (rule.appliesTo === "ORGANIZATION") return Boolean(input.organizationId);
    return rule.appliesTo === input.audience;
  });
}

function pickCommission(rules: CommissionRule[], input: FareQuoteInput, now: Date) {
  let best: CommissionRule | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    if (rule.status !== "ACTIVE") continue;
    if (!inWindow(now, rule.validFrom, rule.validTo)) continue;
    if (rule.airlineCode && rule.airlineCode !== input.airlineCode) continue;
    if (rule.supplierId && rule.supplierId !== input.supplierId) continue;
    let score = 1;
    if (rule.airlineCode) score += 20;
    if (rule.supplierId) score += 5;
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

export function quoteFromCatalog(input: FareQuoteInput, catalog: PricingCatalog, now = new Date()): FareQuote {
  const currency = input.currency ?? "BDT";
  const supplierBase = roundMoney(input.supplierBase);
  const supplierTaxes = roundMoney(input.supplierTaxes);
  const markupRule = pickMarkup(catalog.markups, { ...input, currency }, now);
  const markup = markupRule ? applyValue(markupRule.markupType, Number(markupRule.markupValue), supplierBase) : 0;
  const fees = matchingFees(catalog.fees, input);
  const feeBase = supplierBase + supplierTaxes + markup;
  const serviceFee = roundMoney(fees.reduce((sum, rule) => sum + applyValue(rule.type, Number(rule.amount), feeBase), 0));
  const discount = roundMoney(Math.max(0, Number(input.discount ?? 0)));
  const commissionRule = input.audience === "B2B" ? pickCommission(catalog.commissions, input, now) : null;
  const commission = commissionRule
    ? applyValue(commissionRule.commissionType, Number(commissionRule.commissionValue), supplierBase)
    : 0;
  const { customerPrice } = calculateCustomerPrice({
    supplierFare: supplierBase,
    supplierTaxes,
    markup,
    serviceFee,
    discount,
  });

  return {
    currency,
    supplierBase,
    supplierTaxes,
    markup,
    serviceFee,
    discount,
    commission,
    customerPrice: roundMoney(customerPrice),
    markupRuleId: markupRule?.id ?? null,
    serviceFeeRuleIds: fees.map((rule) => rule.id),
    commissionRuleId: commissionRule?.id ?? null,
  };
}

export function offerRoute(offer: PricableOffer) {
  const outbound = offer.itineraries[0]?.segments ?? [];
  const first = outbound[0];
  const last = outbound[outbound.length - 1];
  return {
    airlineCode: first?.airlineCode,
    origin: first?.origin,
    destination: last?.destination,
    cabin: offer.cabin,
  };
}

export function applyQuoteToOffer<T extends PricableOffer>(offer: T, quote: FareQuote): T {
  return {
    ...offer,
    fare: {
      ...offer.fare,
      currency: quote.currency,
      supplierBase: quote.supplierBase,
      supplierTaxes: quote.supplierTaxes,
      markup: quote.markup,
      serviceFee: quote.serviceFee,
      discount: quote.discount,
      commission: quote.commission,
      base: quote.supplierBase,
      taxes: quote.supplierTaxes,
      total: quote.customerPrice,
      totalLabel: formatMoneyLabel(quote.currency, quote.customerPrice),
    },
  };
}

export function quoteInputFromOffer(offer: PricableOffer, ctx: QuoteContext): FareQuoteInput {
  const route = offerRoute(offer);
  return {
    ...ctx,
    ...route,
    currency: ctx.currency ?? offer.fare.currency,
    supplierBase: offer.fare.supplierBase ?? offer.fare.base,
    supplierTaxes: offer.fare.supplierTaxes ?? offer.fare.taxes,
    discount: offer.fare.discount,
  };
}
