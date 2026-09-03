import { prisma } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { applyQuoteToOffer, quoteFromCatalog, quoteInputFromOffer, type PricingCatalog } from "./engine";
import { markupRulePatchSchema, markupRuleSchema, serviceFeeRulePatchSchema, serviceFeeRuleSchema } from "./schemas";
import type { PricableOffer, QuoteContext } from "./types";

function money(value: { toString(): string } | number) {
  return Math.round(Number(value) * 100) / 100;
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new DomainError("INVALID_DATE", "Invalid date.", 400);
  return date;
}

export async function resolveQuoteContext(userId?: string, supplierId?: string): Promise<QuoteContext> {
  if (!userId) return { audience: "B2C", supplierId };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { orgUsers: { take: 1, orderBy: { createdAt: "asc" } } },
  });
  if (user?.type === "B2B") {
    return { audience: "B2B", organizationId: user.orgUsers[0]?.organizationId, supplierId };
  }
  return { audience: "B2C", supplierId };
}

export async function loadPricingCatalog(): Promise<PricingCatalog> {
  const [markups, fees, commissions] = await Promise.all([
    prisma.markupRule.findMany({ where: { status: "ACTIVE" } }),
    prisma.serviceFeeRule.findMany({ where: { status: "ACTIVE" } }),
    prisma.commissionRule.findMany({ where: { status: "ACTIVE" } }),
  ]);
  return { markups, fees, commissions };
}

export async function quoteOffers<T extends PricableOffer>(offers: T[], ctx: QuoteContext): Promise<T[]> {
  const catalog = await loadPricingCatalog();
  return offers.map((offer) => applyQuoteToOffer(offer, quoteFromCatalog(quoteInputFromOffer(offer, ctx), catalog)));
}

export async function quoteOffer<T extends PricableOffer>(offer: T, ctx: QuoteContext): Promise<T> {
  const catalog = await loadPricingCatalog();
  return applyQuoteToOffer(offer, quoteFromCatalog(quoteInputFromOffer(offer, ctx), catalog));
}

function viewMarkup(rule: Awaited<ReturnType<typeof prisma.markupRule.findFirstOrThrow>>) {
  return {
    id: rule.id,
    supplierId: rule.supplierId,
    airlineCode: rule.airlineCode,
    routeOrigin: rule.routeOrigin,
    routeDest: rule.routeDest,
    cabin: rule.cabin,
    markupType: rule.markupType,
    markupValue: money(rule.markupValue),
    currency: rule.currency,
    appliesTo: rule.appliesTo,
    organizationId: rule.organizationId,
    validFrom: rule.validFrom?.toISOString() ?? null,
    validTo: rule.validTo?.toISOString() ?? null,
    priority: rule.priority,
    status: rule.status,
    createdAt: rule.createdAt.toISOString(),
  };
}

function viewFee(rule: Awaited<ReturnType<typeof prisma.serviceFeeRule.findFirstOrThrow>>) {
  return {
    id: rule.id,
    name: rule.name,
    amount: money(rule.amount),
    type: rule.type,
    appliesTo: rule.appliesTo,
    status: rule.status,
  };
}

export async function listMarkupRules() {
  const rows = await prisma.markupRule.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
  return rows.map(viewMarkup);
}

export async function createMarkupRule(input: unknown) {
  const data = markupRuleSchema.parse(input);
  const created = await prisma.markupRule.create({
    data: {
      supplierId: data.supplierId ?? null,
      airlineCode: data.airlineCode ?? null,
      routeOrigin: data.routeOrigin ?? null,
      routeDest: data.routeDest ?? null,
      cabin: data.cabin ?? null,
      markupType: data.markupType,
      markupValue: data.markupValue,
      currency: data.currency ?? "BDT",
      appliesTo: data.appliesTo,
      organizationId: data.organizationId ?? null,
      validFrom: toDate(data.validFrom),
      validTo: toDate(data.validTo),
      priority: data.priority,
      status: data.status,
    },
  });
  return viewMarkup(created);
}

export async function updateMarkupRule(id: string, input: unknown) {
  const existing = await prisma.markupRule.findUnique({ where: { id } });
  if (!existing) throw new DomainError("RULE_NOT_FOUND", "Markup rule not found.", 404);
  const data = markupRulePatchSchema.parse(input);
  const updated = await prisma.markupRule.update({
    where: { id },
    data: {
      ...(data.supplierId !== undefined ? { supplierId: data.supplierId } : {}),
      ...(data.airlineCode !== undefined ? { airlineCode: data.airlineCode } : {}),
      ...(data.routeOrigin !== undefined ? { routeOrigin: data.routeOrigin } : {}),
      ...(data.routeDest !== undefined ? { routeDest: data.routeDest } : {}),
      ...(data.cabin !== undefined ? { cabin: data.cabin } : {}),
      ...(data.markupType !== undefined ? { markupType: data.markupType } : {}),
      ...(data.markupValue !== undefined ? { markupValue: data.markupValue } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.appliesTo !== undefined ? { appliesTo: data.appliesTo } : {}),
      ...(data.organizationId !== undefined ? { organizationId: data.organizationId } : {}),
      ...(data.validFrom !== undefined ? { validFrom: toDate(data.validFrom) } : {}),
      ...(data.validTo !== undefined ? { validTo: toDate(data.validTo) } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  return viewMarkup(updated);
}

export async function listServiceFeeRules() {
  const rows = await prisma.serviceFeeRule.findMany({ orderBy: { name: "asc" } });
  return rows.map(viewFee);
}

export async function createServiceFeeRule(input: unknown) {
  const data = serviceFeeRuleSchema.parse(input);
  const created = await prisma.serviceFeeRule.create({
    data: {
      name: data.name,
      amount: data.amount,
      type: data.type,
      appliesTo: data.appliesTo,
      status: data.status,
    },
  });
  return viewFee(created);
}

export async function updateServiceFeeRule(id: string, input: unknown) {
  const existing = await prisma.serviceFeeRule.findUnique({ where: { id } });
  if (!existing) throw new DomainError("RULE_NOT_FOUND", "Service fee rule not found.", 404);
  const data = serviceFeeRulePatchSchema.parse(input);
  const updated = await prisma.serviceFeeRule.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.appliesTo !== undefined ? { appliesTo: data.appliesTo } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  return viewFee(updated);
}
