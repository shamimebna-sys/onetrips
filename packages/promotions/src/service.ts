import { prisma } from "@onetrips/database";
import { formatMoneyLabel, loadPricingCatalog, quoteFromCatalog } from "@onetrips/pricing";
import { DomainError, addCents, fromCents, toCents } from "@onetrips/shared";
import { applyPromoSchema, promotionWriteSchema } from "./schemas";

type Snapshot = {
  offer?: {
    type?: string;
    cabin?: string;
    itineraries?: Array<{ segments: Array<{ airlineCode?: string; origin?: string; destination?: string }> }>;
    fare?: {
      total?: number;
      discount?: number;
      totalLabel?: string;
      currency?: string;
      supplierBase?: number;
      supplierTaxes?: number;
      markup?: number;
      serviceFee?: number;
      base?: number;
      taxes?: number;
    };
    name?: string;
  };
};

function snapshotOf(value: unknown): Snapshot {
  return value && typeof value === "object" ? (value as Snapshot) : {};
}

export function computeDiscount(params: {
  total: number;
  percentOff?: number | null;
  amountOff?: number | null;
  maxDiscount?: number | null;
}) {
  const totalCents = toCents(params.total);
  let discountCents = 0;
  if (params.percentOff) {
    discountCents = Math.trunc((totalCents * Number(params.percentOff)) / 100);
  } else if (params.amountOff) {
    discountCents = toCents(params.amountOff);
  }
  if (params.maxDiscount) {
    discountCents = Math.min(discountCents, toCents(params.maxDiscount));
  }
  discountCents = Math.max(0, Math.min(discountCents, totalCents));
  return fromCents(discountCents);
}

export async function listActivePromotions() {
  const now = new Date();
  return prisma.promotion.findMany({
    where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: "desc" },
  });
}

export async function listPromotionsAdmin() {
  return prisma.promotion.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function createPromotion(input: unknown) {
  const data = promotionWriteSchema.parse(input);
  if (!data.percentOff && !data.amountOff) {
    throw new DomainError("VALIDATION", "Set a percent or amount discount.");
  }
  return prisma.promotion.create({
    data: {
      ...data,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
    },
  });
}

function activeRedemptionWhere(now: Date) {
  return {
    OR: [
      { status: "COMMITTED" as const },
      { status: "RESERVED" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  };
}

export async function applyPromoToBooking(bookingId: string, userId: string, input: unknown) {
  const { code } = applyPromoSchema.parse(input);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new DomainError("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (booking.userId !== userId || booking.organizationId) {
    throw new DomainError("FORBIDDEN", "You cannot access this booking.", 403);
  }
  if (!["PAYMENT_PENDING", "PASSENGER_PENDING", "PRICE_CONFIRMED", "PAYMENT_FAILED"].includes(booking.status)) {
    throw new DomainError("INVALID_STATE", "Promo codes can only be applied before payment.");
  }

  const now = new Date();
  const promo = await prisma.promotion.findUnique({ where: { code: code.toUpperCase() } });
  if (!promo || promo.status !== "ACTIVE" || promo.startsAt > now || promo.endsAt < now) {
    throw new DomainError("PROMO_INVALID", "This promo code is not valid.");
  }
  if (promo.currency !== booking.currency) {
    throw new DomainError("PROMO_INVALID", "This promo code is not valid for this currency.");
  }
  if (booking.type === "FLIGHT" && !promo.flightEligible) {
    throw new DomainError("PROMO_INVALID", "This promo is not valid for flights.");
  }
  if (booking.type === "HOTEL" && !promo.hotelEligible) {
    throw new DomainError("PROMO_INVALID", "This promo is not valid for hotels.");
  }

  const snap = snapshotOf(booking.snapshot);
  const first = snap.offer?.itineraries?.[0]?.segments?.[0];
  const last = snap.offer?.itineraries?.[0]?.segments?.[(snap.offer.itineraries[0].segments.length || 1) - 1];
  if (promo.airlineCode && first?.airlineCode && promo.airlineCode !== first.airlineCode) {
    throw new DomainError("PROMO_INVALID", "This promo is not valid for this airline.");
  }
  if (promo.routeOrigin && first?.origin && promo.routeOrigin !== first.origin) {
    throw new DomainError("PROMO_INVALID", "This promo is not valid for this route.");
  }
  if (promo.routeDest && last?.destination && promo.routeDest !== last.destination) {
    throw new DomainError("PROMO_INVALID", "This promo is not valid for this route.");
  }

  const catalog = await loadPricingCatalog();
  const supplierBase = Number(snap.offer?.fare?.supplierBase ?? snap.offer?.fare?.base ?? booking.supplierCost ?? booking.totalAmount);
  const supplierTaxes = Number(snap.offer?.fare?.supplierTaxes ?? snap.offer?.fare?.taxes ?? 0);
  const baseQuote = quoteFromCatalog(
    {
      audience: "B2C",
      currency: booking.currency,
      airlineCode: first?.airlineCode,
      origin: first?.origin,
      destination: last?.destination,
      cabin: snap.offer?.cabin,
      supplierBase,
      supplierTaxes,
      discount: 0,
    },
    catalog,
    now,
  );
  if (promo.minBookingAmount && baseQuote.customerPrice < Number(promo.minBookingAmount)) {
    throw new DomainError("PROMO_INVALID", "This booking does not meet the minimum amount for the promo.");
  }

  const discount = computeDiscount({
    total: baseQuote.customerPrice,
    percentOff: promo.percentOff ? Number(promo.percentOff) : null,
    amountOff: promo.amountOff ? Number(promo.amountOff) : null,
    maxDiscount: promo.maxDiscount ? Number(promo.maxDiscount) : null,
  });
  const quote = quoteFromCatalog(
    {
      audience: "B2C",
      currency: booking.currency,
      airlineCode: first?.airlineCode,
      origin: first?.origin,
      destination: last?.destination,
      cabin: snap.offer?.cabin,
      supplierBase,
      supplierTaxes,
      discount,
    },
    catalog,
    now,
  );

  const nextSnap = {
    ...snap,
    offer: snap.offer
      ? {
          ...snap.offer,
          fare: {
            ...snap.offer.fare,
            discount: quote.discount,
            markup: quote.markup,
            serviceFee: quote.serviceFee,
            total: quote.customerPrice,
            totalLabel: formatMoneyLabel(quote.currency, quote.customerPrice),
            currency: quote.currency,
          },
        }
      : snap.offer,
    promoCode: promo.code,
    quotedTotal: quote.customerPrice,
  };

  const expiresAt = booking.expiresAt && booking.expiresAt > now ? booking.expiresAt : new Date(now.getTime() + 20 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${promo.id} FOR UPDATE`;
    await tx.promotionRedemption.updateMany({
      where: { status: "RESERVED", expiresAt: { lte: now } },
      data: { status: "RELEASED" },
    });

    const used = await tx.promotionRedemption.count({
      where: { promotionId: promo.id, ...activeRedemptionWhere(now), NOT: { bookingId: booking.id } },
    });
    if (promo.usageLimit && used >= promo.usageLimit) {
      throw new DomainError("PROMO_INVALID", "This promo code has been fully used.");
    }
    const usedByUser = await tx.promotionRedemption.count({
      where: { promotionId: promo.id, userId, ...activeRedemptionWhere(now), NOT: { bookingId: booking.id } },
    });
    if (usedByUser >= promo.perCustomerLimit) {
      throw new DomainError("PROMO_INVALID", "You have already used this promo code.");
    }

    await tx.promotionRedemption.deleteMany({ where: { bookingId: booking.id } });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        discountAmount: quote.discount,
        markupAmount: quote.markup,
        serviceFee: quote.serviceFee,
        totalAmount: quote.customerPrice,
        snapshot: nextSnap as object,
      },
    });
    await tx.promotionRedemption.create({
      data: {
        promotionId: promo.id,
        userId,
        bookingId: booking.id,
        amount: quote.discount,
        status: "RESERVED",
        expiresAt,
      },
    });
  });

  return {
    code: promo.code,
    discount: quote.discount,
    total: quote.customerPrice,
    currency: quote.currency,
    quoteVersion: addCents(toCents(quote.customerPrice), toCents(quote.discount)),
    status: "RESERVED" as const,
    expiresAt: expiresAt.toISOString(),
    breakdown: {
      supplierBase: quote.supplierBase,
      supplierTaxes: quote.supplierTaxes,
      markup: quote.markup,
      serviceFee: quote.serviceFee,
      discount: quote.discount,
      total: quote.customerPrice,
    },
  };
}

export async function commitPromoForBooking(bookingId: string) {
  await prisma.promotionRedemption.updateMany({
    where: { bookingId, status: "RESERVED" },
    data: { status: "COMMITTED", committedAt: new Date() },
  });
}

export async function releasePromoForBooking(bookingId: string) {
  await prisma.promotionRedemption.updateMany({
    where: { bookingId, status: { in: ["RESERVED", "COMMITTED"] } },
    data: { status: "RELEASED" },
  });
}
