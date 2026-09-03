import { randomUUID } from "node:crypto";
import { prisma } from "@onetrips/database";
import type { BookingStatus } from "@onetrips/database";
import { DomainError, ProviderNoAvailabilityError, canTransition, customerStatusLabel, isUnknownProviderOutcome, tripGroupFor, type BookingState } from "@onetrips/shared";
import { encryptSecret, getPassenger, maskPassport } from "@onetrips/customer";
import { getFlightProvider, getOffer, revalidateOffer, type FlightOffer, type SearchRequest } from "@onetrips/flight-search";
import {
  getHotelOffer,
  getHotelProvider,
  revalidateHotelOffer,
  type HotelOffer,
  type HotelSearchRequest,
} from "@onetrips/hotel-search";
import { quoteOffer, resolveQuoteContext } from "@onetrips/pricing";
import { createBookingSchema, savePassengersSchema } from "./schemas";

export type BookingSnapshot = {
  product?: "FLIGHT" | "HOTEL";
  sessionId: string;
  request: SearchRequest | HotelSearchRequest;
  offer: FlightOffer | HotelOffer;
  quotedTotal: number;
  previousTotal?: number;
  contact?: { email?: string; phone?: string };
};

function isHotelSnapshot(
  snap: BookingSnapshot,
): snap is BookingSnapshot & { product: "HOTEL"; request: HotelSearchRequest; offer: HotelOffer } {
  return snap.product === "HOTEL";
}

function asState(status: BookingStatus): BookingState {
  return status as BookingState;
}

function snapshotOf(value: unknown): BookingSnapshot {
  return value as BookingSnapshot;
}

function money(value: { toString(): string } | number | string) {
  return Number(value);
}

function flattenHotelStay(offer: HotelOffer) {
  return [
    {
      sequenceNo: 1,
      origin: offer.cityCode.slice(0, 3),
      destination: offer.cityCode.slice(0, 3),
      departureAt: new Date(`${offer.checkIn}T15:00:00.000Z`),
      arrivalAt: new Date(`${offer.checkOut}T11:00:00.000Z`),
      airlineCode: "HT",
      flightNumber: "ROOM",
      cabin: offer.cabin.slice(0, 16),
      baggage: offer.board.slice(0, 64),
    },
  ];
}

function pricingFields(offer: FlightOffer | HotelOffer) {
  const supplierBase = offer.fare.supplierBase ?? offer.fare.base;
  const supplierTaxes = offer.fare.supplierTaxes ?? offer.fare.taxes;
  return {
    totalAmount: offer.fare.total,
    currency: offer.fare.currency,
    supplierCost: supplierBase + supplierTaxes,
    markupAmount: offer.fare.markup ?? 0,
    serviceFee: offer.fare.serviceFee ?? 0,
    discountAmount: offer.fare.discount ?? 0,
  };
}

function bookingRef() {
  return `OT${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function flattenSegments(offer: FlightOffer) {
  const rows: Array<{
    sequenceNo: number;
    origin: string;
    destination: string;
    departureAt: Date;
    arrivalAt: Date;
    airlineCode: string;
    flightNumber: string;
    cabin: string;
    baggage: string;
  }> = [];
  let sequenceNo = 1;
  for (const itinerary of offer.itineraries) {
    for (const leg of itinerary.segments) {
      rows.push({
        sequenceNo,
        origin: leg.origin,
        destination: leg.destination,
        departureAt: new Date(leg.departureAt),
        arrivalAt: new Date(leg.arrivalAt),
        airlineCode: leg.airlineCode.slice(0, 2),
        flightNumber: leg.flightNumber.slice(0, 8),
        cabin: offer.cabin,
        baggage: `${offer.baggage.cabin} cabin / ${offer.baggage.checked} checked`,
      });
      sequenceNo += 1;
    }
  }
  return rows;
}

function ageYears(isoDate: string) {
  const dob = new Date(`${isoDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) years -= 1;
  return years;
}

function assertAge(type: "ADULT" | "CHILD" | "INFANT", dob: string) {
  if (new Date(`${dob}T00:00:00Z`) > new Date()) {
    throw new DomainError("INVALID_DOB", "Date of birth cannot be in the future.");
  }
  const years = ageYears(dob);
  if (type === "INFANT" && years >= 2) throw new DomainError("INVALID_AGE", "Infants must be under 2 years.");
  if (type === "CHILD" && (years < 2 || years >= 12)) throw new DomainError("INVALID_AGE", "Children must be 2–11 years.");
  if (type === "ADULT" && years < 12) throw new DomainError("INVALID_AGE", "Adults must be 12 or older.");
}

async function isInternational(offer: FlightOffer) {
  const codes = [...new Set(offer.itineraries.flatMap((row) => row.segments.flatMap((leg) => [leg.origin, leg.destination])))];
  const airports = await prisma.airport.findMany({
    where: { iataCode: { in: codes } },
    include: { city: { include: { country: true } } },
  });
  const countries = new Set(airports.map((row) => row.city.country.code));
  return countries.size > 1;
}

async function move(
  bookingId: string,
  from: BookingStatus,
  to: BookingStatus,
  actor: { id: string; type: string },
  reason?: string,
) {
  if (from === to) {
    return prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  }
  if (!canTransition(asState(from), asState(to))) {
    throw new DomainError("ILLEGAL_TRANSITION", `Cannot move booking from ${from} to ${to}.`);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, status: from },
      data: { status: to },
    });
    if (updated.count === 0) {
      const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (current.status === to) return current;
      throw new DomainError(
        "ILLEGAL_TRANSITION",
        `Cannot move booking from ${from} to ${to} (current ${current.status}).`,
      );
    }
    await tx.bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus: from,
        toStatus: to,
        reason: reason?.slice(0, 255),
        actorId: actor.id === "gateway" ? undefined : actor.id,
        actorType: actor.type.slice(0, 32),
      },
    });
    return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  });
}

const BOOKING_INCLUDE = {
  passengers: true,
  segments: { orderBy: { sequenceNo: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { createdAt: "desc" as const }, take: 5 },
  tickets: { orderBy: { issuedAt: "asc" as const } },
  invoices: { where: { status: { not: "VOID" as const } }, orderBy: { createdAt: "desc" as const }, take: 5 },
  user: { select: { id: true, email: true, displayName: true, phone: true, type: true, status: true } },
  organization: { select: { id: true, name: true } },
};

async function actorFor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { type: true } });
  return { id: userId, type: user?.type === "B2B" ? "B2B" : "CUSTOMER" };
}

async function assertCanAccessBooking(
  booking: { userId: string | null; organizationId: string | null },
  userId: string,
) {
  if (booking.organizationId) {
    const membership = await prisma.organizationUser.findFirst({
      where: { userId, organizationId: booking.organizationId },
    });
    if (!membership) {
      throw new DomainError("FORBIDDEN", "You cannot access this booking.", 403);
    }
    return;
  }
  if (booking.userId !== userId) {
    throw new DomainError("FORBIDDEN", "You cannot access this booking.", 403);
  }
}

async function resolveBookingOrganization(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { orgUsers: { include: { organization: true }, take: 1 } },
  });
  if (!user || user.type !== "B2B") {
    return { organizationId: null as string | null, actorType: "CUSTOMER" };
  }
  const membership = user.orgUsers[0];
  if (!membership || membership.organization.deletedAt) {
    throw new DomainError("ORG_NOT_FOUND", "No agency is linked to this account.", 404);
  }
  if (membership.organization.status !== "ACTIVE") {
    throw new DomainError("ORG_INACTIVE", "Agency is not active for booking.", 403);
  }
  return { organizationId: membership.organizationId, actorType: "B2B" };
}

async function loadOwned(bookingId: string, userId: string) {
  const include = BOOKING_INCLUDE;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include });
  if (!booking) throw new DomainError("BOOKING_NOT_FOUND", "Booking not found.", 404);
  await assertCanAccessBooking(booking, userId);
  if (booking.expiresAt && booking.expiresAt <= new Date() && canTransition(asState(booking.status), "EXPIRED")) {
    await move(booking.id, booking.status, "EXPIRED", { id: userId, type: "SYSTEM" }, "Hold expired");
    return prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include });
  }
  return booking;
}

function toView(booking: Awaited<ReturnType<typeof loadOwned>>) {
  const snap = snapshotOf(booking.snapshot);
  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    status: booking.status,
    type: booking.type,
    totalAmount: money(booking.totalAmount),
    currency: booking.currency,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    providerRef: booking.providerRef,
    createdAt: booking.createdAt.toISOString(),
    owner: booking.user
      ? {
          id: booking.user.id,
          email: booking.user.email,
          displayName: booking.user.displayName,
          phone: booking.user.phone,
          type: booking.user.type,
          status: booking.user.status,
        }
      : null,
    organization: booking.organization ? { id: booking.organization.id, name: booking.organization.name } : null,
    next: {
      canAcceptPrice: canTransition(asState(booking.status), "SELECTED") && booking.status === "PRICE_CHANGED",
      canSavePassengers: booking.status === "PASSENGER_PENDING",
      canPay: booking.status === "PAYMENT_PENDING" || booking.status === "PAYMENT_FAILED",
      awaitingPayment: booking.status === "PAYMENT_PROCESSING",
      paid:
        booking.status === "BOOKED" ||
        booking.status === "PAYMENT_SUCCESS" ||
        booking.status === "BOOKING_PENDING" ||
        booking.status === "TICKETING_PENDING" ||
        booking.status === "TICKETED" ||
        booking.status === "TICKETING_FAILED" ||
        booking.status === "TICKETING_UNKNOWN" ||
        booking.status === "BOOKING_UNKNOWN",
      canIssueTickets:
        booking.status === "BOOKED" ||
        booking.status === "TICKETING_PENDING" ||
        booking.status === "TICKETING_FAILED",
      issuingTickets: booking.status === "BOOKED" || booking.status === "TICKETING_PENDING",
      ticketed: booking.status === "TICKETED",
      searchAgain: booking.status === "UNAVAILABLE" || booking.status === "EXPIRED",
      canCancel: canTransition(asState(booking.status), "CANCELLED") || booking.status === "BOOKING_FAILED",
      canRefund:
        booking.status === "BOOKING_FAILED" ||
        booking.status === "CANCELLED" ||
        booking.status === "REFUND_PENDING",
      cancelled: booking.status === "CANCELLED" || booking.status === "REFUND_PENDING" || booking.status === "REFUNDED",
      refunded: booking.status === "REFUNDED",
      bookingUnknown: booking.status === "BOOKING_UNKNOWN",
      ticketingUnknown: booking.status === "TICKETING_UNKNOWN",
      canResolveProvider: booking.status === "BOOKING_UNKNOWN" || booking.status === "TICKETING_UNKNOWN",
    },
    request: snap.request,
    offer: snap.offer
      ? {
          ...snap.offer,
          previousTotal: snap.previousTotal,
        }
      : null,
    quotedTotal: snap.quotedTotal,
    hotel: isHotelSnapshot(snap)
      ? {
          name: snap.offer.name,
          starRating: snap.offer.starRating,
          city: snap.offer.city,
          cityCode: snap.offer.cityCode,
          country: snap.offer.country,
          address: snap.offer.address,
          checkIn: snap.offer.checkIn,
          checkOut: snap.offer.checkOut,
          nights: snap.offer.nights,
          room: snap.offer.room,
          board: snap.offer.board,
          amenities: snap.offer.amenities,
        }
      : null,
    contact: snap.contact ?? null,
    segments: booking.segments.map((row) => ({
      sequenceNo: row.sequenceNo,
      origin: row.origin,
      destination: row.destination,
      departureAt: row.departureAt.toISOString(),
      arrivalAt: row.arrivalAt.toISOString(),
      airlineCode: row.airlineCode,
      flightNumber: row.flightNumber,
      cabin: row.cabin,
      baggage: row.baggage,
    })),
    passengers: booking.passengers.map((row) => ({
      id: row.id,
      type: row.type,
      firstName: row.firstName,
      lastName: row.lastName,
      nationality: row.nationality,
      dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : "",
      passportExpiry: row.passportExpiry ? row.passportExpiry.toISOString().slice(0, 10) : "",
      passportNumberMasked: maskPassport(row.passportNumber),
      ticketNumber: row.ticketNumber,
    })),
    history: booking.history.map((row) => ({
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      reason: row.reason,
      at: row.createdAt.toISOString(),
    })),
    payments: booking.payments.map((row) => ({
      id: row.id,
      status: row.status,
      method: row.method,
      amount: money(row.amount),
      currency: row.currency,
      providerRef: row.providerRef,
      createdAt: row.createdAt.toISOString(),
    })),
    tickets: booking.tickets.map((row) => ({
      id: row.id,
      ticketNumber: row.ticketNumber,
      status: row.status,
      passengerId: row.bookingPassengerId,
      issuedAt: row.issuedAt.toISOString(),
      pdfUrl: row.pdfUrl ?? `/api/bookings/${booking.id}/tickets/${row.ticketNumber}/pdf`,
    })),
    invoices: booking.invoices.map((row) => ({
      id: row.id,
      invoiceNo: row.invoiceNo,
      status: row.status,
      total: money(row.total),
      currency: row.currency,
      pdfUrl: row.pdfUrl ?? `/api/bookings/${booking.id}/invoice/pdf`,
    })),
    markupAmount: money(booking.markupAmount ?? 0),
    serviceFee: money(booking.serviceFee ?? 0),
    discountAmount: money(booking.discountAmount ?? 0),
    supplierCost: booking.supplierCost != null ? money(booking.supplierCost) : null,
  };
}

async function afterRevalidate(
  bookingId: string,
  fromStatus: BookingStatus,
  userId: string,
  sessionId: string,
  offerId: string,
  previous: FlightOffer | HotelOffer,
) {
  const actor = await actorFor(userId);
  try {
    const snap = snapshotOf((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).snapshot);
    const result = isHotelSnapshot(snap)
      ? await revalidateHotelOffer(sessionId, offerId)
      : await revalidateOffer(sessionId, offerId);
    const next = result.offer;
    const priceChanged = next.fare.total !== previous.fare.total;
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        ...pricingFields(next),
        snapshot: {
          ...snap,
          offer: next,
          quotedTotal: next.fare.total,
          previousTotal: priceChanged ? previous.fare.total : snap.previousTotal,
        },
      },
    });
    if (priceChanged) {
      await move(bookingId, fromStatus, "PRICE_CHANGED", actor, "Supplier fare changed");
      return;
    }
    await move(bookingId, fromStatus, "PRICE_CONFIRMED", actor, "Fare confirmed");
    await move(bookingId, "PRICE_CONFIRMED", "PASSENGER_PENDING", actor);
  } catch (error) {
    if (
      error instanceof ProviderNoAvailabilityError ||
      (error instanceof DomainError && error.code === "FARE_UNAVAILABLE")
    ) {
      await move(bookingId, fromStatus, "UNAVAILABLE", actor, "This fare is no longer available.");
      return;
    }
    throw error;
  }
}

async function createHotelBookingFromOffer(
  userId: string,
  data: { sessionId: string; offerId: string },
  ownership: { organizationId: string | null; actorType: string },
) {
  const loaded = await getHotelOffer(data.sessionId, data.offerId);
  const { request, expiresAt, sessionId } = loaded;
  const supplier = await prisma.supplier.findFirst({ where: { type: "HOTEL", status: "ACTIVE" } });
  const offer = await quoteOffer(loaded.offer, await resolveQuoteContext(userId, supplier?.id));

  const existing = await prisma.booking.findMany({
    where: {
      userId,
      organizationId: ownership.organizationId,
      type: "HOTEL",
      status: { notIn: ["EXPIRED", "CANCELLED", "REFUNDED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  const reuse = existing.find((row) => {
    const snap = snapshotOf(row.snapshot);
    return snap.sessionId === sessionId && snap.offer?.id === offer.id;
  });
  if (reuse) {
    return getBooking(reuse.id, userId);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const holdUntil = new Date(Math.min(new Date(expiresAt).getTime(), Date.now() + 20 * 60 * 1000));
  const snapshot: BookingSnapshot = {
    product: "HOTEL",
    sessionId,
    request,
    offer,
    quotedTotal: offer.fare.total,
    contact: { email: user?.email ?? undefined, phone: user?.phone ?? undefined },
  };
  const actor = { id: userId, type: ownership.actorType };

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingRef: bookingRef(),
        type: "HOTEL",
        status: "SEARCHED",
        userId,
        organizationId: ownership.organizationId,
        supplierId: supplier?.id,
        ...pricingFields(offer),
        snapshot,
        expiresAt: holdUntil,
        segments: { create: flattenHotelStay(offer) },
      },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: created.id,
        fromStatus: null,
        toStatus: "SEARCHED",
        actorId: userId,
        actorType: actor.type,
        reason: ownership.organizationId ? "Room selected from B2B search" : "Room selected from search",
      },
    });
    return created;
  });

  await move(booking.id, "SEARCHED", "SELECTED", actor);
  await move(booking.id, "SELECTED", "REVALIDATING", actor);
  await afterRevalidate(booking.id, "REVALIDATING", userId, sessionId, offer.id, offer);
  return getBooking(booking.id, userId);
}

export async function createBookingFromOffer(userId: string, input: unknown) {
  const data = createBookingSchema.parse(input);
  const ownership = await resolveBookingOrganization(userId);
  if (data.product === "HOTEL") {
    return createHotelBookingFromOffer(userId, data, ownership);
  }
  const loaded = await getOffer(data.sessionId, data.offerId);
  const { request, expiresAt, sessionId } = loaded;
  const supplier = await prisma.supplier.findFirst({ where: { type: "GDS", status: "ACTIVE" } });
  const offer = await quoteOffer(loaded.offer, await resolveQuoteContext(userId, supplier?.id));

  const existing = await prisma.booking.findMany({
    where: {
      userId,
      organizationId: ownership.organizationId,
      type: "FLIGHT",
      status: { notIn: ["EXPIRED", "CANCELLED", "REFUNDED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  const reuse = existing.find((row) => {
    const snap = snapshotOf(row.snapshot);
    return snap.sessionId === sessionId && snap.offer?.id === offer.id;
  });
  if (reuse) {
    return getBooking(reuse.id, userId);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const holdUntil = new Date(Math.min(new Date(expiresAt).getTime(), Date.now() + 20 * 60 * 1000));
  const snapshot: BookingSnapshot = {
    sessionId,
    request,
    offer,
    quotedTotal: offer.fare.total,
    contact: { email: user?.email ?? undefined, phone: user?.phone ?? undefined },
  };
  const actor = { id: userId, type: ownership.actorType };

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingRef: bookingRef(),
        type: "FLIGHT",
        status: "SEARCHED",
        userId,
        organizationId: ownership.organizationId,
        supplierId: supplier?.id,
        ...pricingFields(offer),
        snapshot,
        expiresAt: holdUntil,
        segments: { create: flattenSegments(offer) },
      },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: created.id,
        fromStatus: null,
        toStatus: "SEARCHED",
        actorId: userId,
        actorType: actor.type,
        reason: ownership.organizationId ? "Offer selected from B2B search" : "Offer selected from search",
      },
    });
    return created;
  });

  await move(booking.id, "SEARCHED", "SELECTED", actor);
  await move(booking.id, "SELECTED", "REVALIDATING", actor);
  await afterRevalidate(booking.id, "REVALIDATING", userId, sessionId, offer.id, offer);
  return getBooking(booking.id, userId);
}

export async function acceptPriceChange(bookingId: string, userId: string) {
  const booking = await loadOwned(bookingId, userId);
  if (booking.status !== "PRICE_CHANGED") {
    throw new DomainError("INVALID_STATUS", "There is no new fare to accept.");
  }
  const snap = snapshotOf(booking.snapshot);
  const actor = await actorFor(userId);
  await move(booking.id, "PRICE_CHANGED", "SELECTED", actor, "Accepted new fare");
  await move(booking.id, "SELECTED", "REVALIDATING", actor);
  await afterRevalidate(booking.id, "REVALIDATING", userId, snap.sessionId, snap.offer.id, snap.offer);
  return getBooking(booking.id, userId);
}

export async function savePassengers(bookingId: string, userId: string, input: unknown) {
  const booking = await loadOwned(bookingId, userId);
  if (booking.status !== "PASSENGER_PENDING") {
    throw new DomainError("INVALID_STATUS", "Passengers can only be added while the booking is awaiting traveler details.");
  }
  const data = savePassengersSchema.parse(input);
  const snap = snapshotOf(booking.snapshot);
  const needed = {
    ADULT: snap.request.adults,
    CHILD: snap.request.children,
    INFANT: snap.request.infants,
  };
  const counts = { ADULT: 0, CHILD: 0, INFANT: 0 };
  const international = isHotelSnapshot(snap) ? false : await isInternational(snap.offer as FlightOffer);

  const resolved = [];
  for (const passenger of data.passengers) {
    let row = passenger;
    if (passenger.savedPassengerId) {
      const saved = await getPassenger(userId, passenger.savedPassengerId);
      row = {
        type: passenger.type,
        firstName: saved.firstName,
        lastName: saved.lastName,
        dateOfBirth: saved.dateOfBirth || passenger.dateOfBirth,
        nationality: saved.nationality || passenger.nationality,
        passportNumber: saved.passportNumber || passenger.passportNumber || "",
        passportExpiry: saved.passportExpiry || passenger.passportExpiry || "",
      };
    }
    assertAge(row.type, row.dateOfBirth);
    counts[row.type] += 1;
    if (international && !row.passportNumber) {
      throw new DomainError("PASSPORT_REQUIRED", "Passport number is required for international travel.");
    }
    if (row.passportExpiry && new Date(`${row.passportExpiry}T00:00:00Z`) < new Date()) {
      throw new DomainError("PASSPORT_EXPIRED", "Passport expiry must be in the future.");
    }
    resolved.push(row);
  }

  if (counts.ADULT !== needed.ADULT || counts.CHILD !== needed.CHILD || counts.INFANT !== needed.INFANT) {
    throw new DomainError(
      "PASSENGER_MISMATCH",
      `This fare requires ${needed.ADULT} adult(s), ${needed.CHILD} child(ren), and ${needed.INFANT} infant(s).`,
    );
  }

  await prisma.$transaction([
    prisma.bookingPassenger.deleteMany({ where: { bookingId } }),
    prisma.bookingPassenger.createMany({
      data: resolved.map((row) => ({
        bookingId,
        type: row.type,
        firstName: row.firstName,
        lastName: row.lastName,
        nationality: row.nationality,
        dateOfBirth: new Date(`${row.dateOfBirth}T00:00:00Z`),
        passportExpiry: row.passportExpiry ? new Date(`${row.passportExpiry}T00:00:00Z`) : null,
        passportNumber: row.passportNumber ? encryptSecret(row.passportNumber.toUpperCase()) : null,
      })),
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        snapshot: {
          ...snap,
          contact: {
            email: data.contactEmail || snap.contact?.email,
            phone: data.contactPhone || snap.contact?.phone,
          },
        },
      },
    }),
  ]);

  await move(bookingId, "PASSENGER_PENDING", "PAYMENT_PENDING", await actorFor(userId), "Travelers captured");
  return getBooking(bookingId, userId);
}

function hasRefundPenalty(offer: FlightOffer) {
  const penalties = offer.fareRules?.penalties ?? offer.penalties ?? [];
  return penalties.some((row) => row.type === "REFUND" && typeof row.amount === "number" && !Number.isNaN(row.amount));
}

async function withAttachedFareRules<T extends { type?: string; offer: FlightOffer | HotelOffer | null }>(view: T): Promise<T> {
  const offer = view.offer;
  if (!offer || view.type === "HOTEL" || !("refundable" in offer) || !offer.refundable || hasRefundPenalty(offer as FlightOffer)) {
    return view;
  }
  try {
    const fareRules = await getFlightProvider().getFareRules(offer.id);
    return {
      ...view,
      offer: {
        ...offer,
        fareRules,
        penalties: fareRules.penalties,
      },
    };
  } catch {
    return view;
  }
}

export async function getBooking(bookingId: string, userId: string) {
  const booking = await loadOwned(bookingId, userId);
  return withAttachedFareRules(toView(booking));
}

export async function listBookings(userId: string) {
  const rows = await prisma.booking.findMany({
    where: { userId, organizationId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { segments: { orderBy: { sequenceNo: "asc" } } },
  });
  return rows.map((row) => {
    const snap = snapshotOf(row.snapshot);
    const first = row.segments[0];
    const last = row.segments[row.segments.length - 1];
    const snapSeg = snap.offer?.itineraries[0]?.segments[0];
    const travelAt = row.type === "HOTEL" ? (last?.arrivalAt ?? first?.departureAt) : (first?.departureAt ?? last?.arrivalAt);
    const group = tripGroupFor({ status: row.status, travelAt });
    return {
      id: row.id,
      bookingRef: row.bookingRef,
      status: row.status,
      label: customerStatusLabel(row.status),
      group,
      totalAmount: money(row.totalAmount),
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      origin: first?.origin ?? snapSeg?.origin,
      destination: last?.destination ?? snap.offer?.itineraries[0]?.segments[snap.offer.itineraries[0].segments.length - 1]?.destination,
      departureAt: first?.departureAt.toISOString() ?? null,
      travelAt: travelAt?.toISOString() ?? null,
      type: row.type,
      airlineCode: first?.airlineCode ?? snapSeg?.airlineCode ?? null,
      flightNumber: first?.flightNumber ?? (snapSeg && "flightNumber" in snapSeg ? snapSeg.flightNumber : null) ?? null,
    };
  });
}

export async function listOrganizationBookings(organizationId: string) {
  const rows = await prisma.booking.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      segments: { orderBy: { sequenceNo: "asc" }, take: 1 },
      passengers: { take: 1 },
      tickets: { orderBy: { issuedAt: "desc" }, take: 1 },
      invoices: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return rows.map((row) => {
    const snap = snapshotOf(row.snapshot);
    const lastSeg = snap.offer?.itineraries[0]?.segments[snap.offer.itineraries[0].segments.length - 1];
    const passenger = row.passengers[0];
    const invoice = row.invoices[0];
    return {
      id: row.id,
      bookingRef: row.bookingRef,
      pnr: row.providerRef,
      status: row.status,
      ticketStatus: row.tickets[0]?.status ?? (row.status === "TICKETED" ? "ISSUED" : null),
      totalAmount: money(row.totalAmount),
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      origin: row.segments[0]?.origin ?? snap.offer?.itineraries[0]?.segments[0]?.origin,
      destination: row.segments[0]?.destination ?? lastSeg?.destination,
      departureAt: row.segments[0]?.departureAt.toISOString() ?? null,
      passenger: passenger ? `${passenger.firstName} ${passenger.lastName}` : null,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNo: invoice.invoiceNo,
            status: invoice.status,
            pdfUrl: invoice.pdfUrl ?? `/api/bookings/${row.id}/invoice/pdf`,
          }
        : null,
    };
  });
}

async function loadById(bookingId: string) {
  const include = BOOKING_INCLUDE;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include });
  if (!booking) throw new DomainError("BOOKING_NOT_FOUND", "Booking not found.", 404);
  return booking;
}

export async function beginPayment(bookingId: string, actor: { id: string; type: string }) {
  const booking = await loadById(bookingId);
  if (booking.status === "PAYMENT_PROCESSING") return toView(booking);
  if (booking.status === "PAYMENT_FAILED") {
    await move(booking.id, "PAYMENT_FAILED", "PAYMENT_PENDING", actor, "Retry payment");
  }
  const current = await loadById(bookingId);
  if (current.status !== "PAYMENT_PENDING") {
    throw new DomainError("INVALID_STATUS", "This booking is not ready for payment.");
  }
  if (current.expiresAt && current.expiresAt <= new Date()) {
    await move(current.id, current.status, "EXPIRED", { id: actor.id, type: "SYSTEM" }, "Hold expired");
    throw new DomainError("BOOKING_EXPIRED", "This booking hold has expired.", 410);
  }
  await move(current.id, "PAYMENT_PENDING", "PAYMENT_PROCESSING", actor, "Payment initiated");
  return getBookingById(bookingId);
}

export async function failPayment(bookingId: string, actor: { id: string; type: string }, reason?: string) {
  const booking = await loadById(bookingId);
  if (booking.status === "PAYMENT_FAILED") return toView(booking);
  if (booking.status !== "PAYMENT_PROCESSING") {
    throw new DomainError("INVALID_STATUS", "Payment is not in progress for this booking.");
  }
  await move(booking.id, "PAYMENT_PROCESSING", "PAYMENT_FAILED", actor, reason ?? "Gateway declined");
  return getBookingById(bookingId);
}

export async function succeedPayment(bookingId: string, actor: { id: string; type: string }) {
  let booking = await loadById(bookingId);
  if (
    booking.status === "BOOKED" ||
    booking.status === "BOOKING_FAILED" ||
    booking.status === "TICKETING_PENDING" ||
    booking.status === "TICKETED" ||
    booking.status === "TICKETING_FAILED" ||
    booking.status === "TICKETING_UNKNOWN" ||
    booking.status === "BOOKING_UNKNOWN"
  ) {
    if (booking.status === "BOOKING_UNKNOWN") {
      return resolveSupplierBooking(bookingId, actor);
    }
    return toView(booking);
  }

  if (booking.status === "PAYMENT_PROCESSING") {
    await move(booking.id, "PAYMENT_PROCESSING", "PAYMENT_SUCCESS", actor, "Payment captured");
    await move(booking.id, "PAYMENT_SUCCESS", "BOOKING_PENDING", actor, "Create supplier reservation");
  } else if (booking.status === "PAYMENT_SUCCESS") {
    await move(booking.id, "PAYMENT_SUCCESS", "BOOKING_PENDING", actor, "Create supplier reservation");
  } else if (booking.status !== "BOOKING_PENDING") {
    throw new DomainError("INVALID_STATUS", "Payment is not in progress for this booking.");
  }

  booking = await loadById(bookingId);
  if (booking.providerRef) {
    if (booking.status === "BOOKING_PENDING") {
      await move(bookingId, "BOOKING_PENDING", "BOOKED", actor, `PNR ${booking.providerRef}`);
    }
    return getBookingById(bookingId);
  }
  try {
    const created = booking.type === "HOTEL"
      ? await getHotelProvider().createBooking({
          bookingId,
          bookingRef: booking.bookingRef,
          passengerCount: booking.passengers.length,
          correlationId: randomUUID(),
          idempotencyKey: `book:${bookingId}`,
        })
      : await getFlightProvider().createBooking({
          bookingId,
          bookingRef: booking.bookingRef,
          passengerCount: booking.passengers.length,
          correlationId: randomUUID(),
          idempotencyKey: `book:${bookingId}`,
        });
    await prisma.booking.update({
      where: { id: bookingId },
      data: { providerRef: created.providerRef },
    });
    await move(bookingId, "BOOKING_PENDING", "BOOKED", actor, `PNR ${created.providerRef}`);
  } catch (error) {
    if (isUnknownProviderOutcome(error)) {
      await move(bookingId, "BOOKING_PENDING", "BOOKING_UNKNOWN", actor, "Supplier booking result is unconfirmed");
    } else {
      await move(
        bookingId,
        "BOOKING_PENDING",
        "BOOKING_FAILED",
        actor,
        error instanceof Error ? error.message.slice(0, 255) : "Supplier booking failed",
      );
    }
  }
  return getBookingById(bookingId);
}

export async function getBookingById(bookingId: string) {
  return toView(await loadById(bookingId));
}

export async function beginTicketing(bookingId: string, actor: { id: string; type: string }) {
  const booking = await loadById(bookingId);
  if (booking.status === "TICKETED") return toView(booking);
  if (booking.status === "TICKETING_PENDING") return toView(booking);
  if (booking.status === "TICKETING_UNKNOWN") {
    throw new DomainError("TICKETING_UNKNOWN", "Confirm the airline ticket status before issuing again.");
  }
  if (booking.status === "TICKETING_FAILED") {
    await move(booking.id, "TICKETING_FAILED", "TICKETING_PENDING", actor, "Retry ticketing");
    return getBookingById(bookingId);
  }
  if (booking.status !== "BOOKED") {
    throw new DomainError("INVALID_STATUS", "This booking is not ready for ticketing.");
  }
  await move(booking.id, "BOOKED", "TICKETING_PENDING", actor, "Issue e-tickets");
  return getBookingById(bookingId);
}

export async function failTicketing(bookingId: string, actor: { id: string; type: string }, reason?: string) {
  const booking = await loadById(bookingId);
  if (booking.status === "TICKETING_FAILED") return toView(booking);
  if (booking.status === "TICKETING_UNKNOWN") {
    await move(booking.id, "TICKETING_UNKNOWN", "TICKETING_FAILED", actor, reason ?? "Ticketing failed");
    return getBookingById(bookingId);
  }
  if (booking.status !== "TICKETING_PENDING") {
    throw new DomainError("INVALID_STATUS", "Ticketing is not in progress for this booking.");
  }
  await move(booking.id, "TICKETING_PENDING", "TICKETING_FAILED", actor, reason ?? "Ticketing failed");
  return getBookingById(bookingId);
}

export async function unknownTicketing(bookingId: string, actor: { id: string; type: string }, reason?: string) {
  const booking = await loadById(bookingId);
  if (booking.status === "TICKETING_UNKNOWN" || booking.status === "TICKETED") return toView(booking);
  if (booking.status !== "TICKETING_PENDING") {
    throw new DomainError("INVALID_STATUS", "Ticketing is not in progress for this booking.");
  }
  await move(booking.id, "TICKETING_PENDING", "TICKETING_UNKNOWN", actor, reason ?? "Ticketing result is unconfirmed");
  return getBookingById(bookingId);
}

export async function resolveSupplierBooking(bookingId: string, actor: { id: string; type: string }) {
  const booking = await loadById(bookingId);
  if (booking.status === "BOOKED" || booking.status === "TICKETED" || booking.status === "TICKETING_PENDING") {
    return toView(booking);
  }
  if (booking.status !== "BOOKING_UNKNOWN" && booking.status !== "BOOKING_PENDING") {
    throw new DomainError("INVALID_STATUS", "This booking does not need supplier resolution.");
  }
  const looked = booking.type === "HOTEL"
    ? await getHotelProvider().getBookingStatus({
        bookingId,
        providerRef: booking.providerRef ?? undefined,
        idempotencyKey: `book:${bookingId}`,
        correlationId: randomUUID(),
      })
    : await getFlightProvider().getBookingStatus({
        bookingId,
        providerRef: booking.providerRef ?? undefined,
        idempotencyKey: `book:${bookingId}`,
        correlationId: randomUUID(),
      });
  if ((looked.status === "CONFIRMED" || looked.status === "TICKETED") && looked.providerRef) {
    await prisma.booking.update({ where: { id: bookingId }, data: { providerRef: looked.providerRef } });
    if (booking.status === "BOOKING_PENDING") {
      await move(bookingId, "BOOKING_PENDING", "BOOKED", actor, `PNR ${looked.providerRef}`);
    } else {
      await move(bookingId, "BOOKING_UNKNOWN", "BOOKED", actor, `PNR ${looked.providerRef}`);
    }
    return getBookingById(bookingId);
  }
  if (looked.status === "FAILED") {
    const from = booking.status === "BOOKING_PENDING" ? "BOOKING_PENDING" : "BOOKING_UNKNOWN";
    await move(bookingId, from, "BOOKING_FAILED", actor, "Supplier confirmed the reservation failed");
    return getBookingById(bookingId);
  }
  return getBookingById(bookingId);
}

export async function succeedTicketing(bookingId: string, actor: { id: string; type: string }, reason?: string) {
  const booking = await loadById(bookingId);
  if (booking.status === "TICKETED") return toView(booking);
  if (!booking.tickets.some((ticket) => ticket.status === "ISSUED")) {
    throw new DomainError("TICKETED_WITHOUT_TICKETS", "Cannot mark this booking ticketed until e-tickets exist.");
  }
  if (booking.status === "TICKETING_UNKNOWN") {
    await move(booking.id, "TICKETING_UNKNOWN", "TICKETED", actor, reason ?? "E-tickets confirmed");
    return getBookingById(bookingId);
  }
  if (booking.status !== "TICKETING_PENDING") {
    throw new DomainError("INVALID_STATUS", "Ticketing is not in progress for this booking.");
  }
  await move(booking.id, "TICKETING_PENDING", "TICKETED", actor, reason ?? "E-tickets issued");
  return getBookingById(bookingId);
}

export async function cancelBookingRecord(bookingId: string, actor: { id: string; type: string }, reason?: string) {
  const booking = await loadById(bookingId);
  if (booking.status === "CANCELLED" || booking.status === "REFUND_PENDING" || booking.status === "REFUNDED") {
    return toView(booking);
  }
  if (booking.status === "BOOKING_FAILED") {
    await move(booking.id, "BOOKING_FAILED", "REFUND_PENDING", actor, reason ?? "Refund after failed reservation");
    return getBookingById(bookingId);
  }
  if (!canTransition(asState(booking.status), "CANCELLED")) {
    throw new DomainError("INVALID_STATUS", `This booking cannot be cancelled from ${booking.status}.`);
  }
  await move(booking.id, booking.status, "CANCELLED", actor, reason ?? "Booking cancelled");
  return getBookingById(bookingId);
}

export async function startRefund(bookingId: string, actor: { id: string; type: string }, reason?: string) {
  const booking = await loadById(bookingId);
  if (booking.status === "REFUND_PENDING" || booking.status === "REFUNDED") return toView(booking);
  if (booking.status === "BOOKING_FAILED") {
    await move(booking.id, "BOOKING_FAILED", "REFUND_PENDING", actor, reason ?? "Refund initiated");
    return getBookingById(bookingId);
  }
  if (booking.status !== "CANCELLED") {
    throw new DomainError("INVALID_STATUS", "A booking must be cancelled before a refund can start.");
  }
  await move(booking.id, "CANCELLED", "REFUND_PENDING", actor, reason ?? "Refund initiated");
  return getBookingById(bookingId);
}

export async function completeRefund(bookingId: string, actor: { id: string; type: string }, reason?: string) {
  const booking = await loadById(bookingId);
  if (booking.status === "REFUNDED") return toView(booking);
  if (booking.status !== "REFUND_PENDING") {
    throw new DomainError("INVALID_STATUS", "A refund is not pending for this booking.");
  }
  await move(booking.id, "REFUND_PENDING", "REFUNDED", actor, reason ?? "Refund completed");
  return getBookingById(bookingId);
}
