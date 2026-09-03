import { prisma } from "@onetrips/database";
import { randomUUID } from "node:crypto";
import { DomainError, ProviderTicketingError, isUnknownProviderOutcome } from "@onetrips/shared";
import {
  beginTicketing,
  failTicketing,
  getBooking,
  getBookingById,
  succeedTicketing,
  unknownTicketing,
  resolveSupplierBooking,
} from "@onetrips/booking";
import { getFlightProvider } from "@onetrips/flight-search";
import { getHotelProvider } from "@onetrips/hotel-search";
import { describeEmailProvider, describeSmsProvider, enqueueNotification } from "@onetrips/notifications";
import { issueBookingInvoice } from "@onetrips/finance";
import { buildTicketPdf, money, type TicketPdfFareLine, type TicketPdfInput, type TicketPdfPenalty } from "./pdf";
import { buildHotelVoucherPdf, type HotelVoucherPdfInput } from "./voucher-pdf";

type BookingView = Awaited<ReturnType<typeof getBookingById>>;

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function pdfPath(bookingId: string, ticketNumber: string) {
  return `/api/bookings/${bookingId}/tickets/${ticketNumber}/pdf`;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBool(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function offerSegment(
  leg: {
    origin: string;
    destination: string;
    airlineName?: unknown;
    airlineCode?: unknown;
    flightNumber?: unknown;
    originCity?: unknown;
    destinationCity?: unknown;
    departureAt?: unknown;
    arrivalAt?: unknown;
    departureTime?: unknown;
    arrivalTime?: unknown;
    durationLabel?: unknown;
    cabin?: unknown;
    baggage?: unknown;
    aircraft?: unknown;
  },
) {
  const departure =
    typeof leg.departureAt === "string" && leg.departureAt
      ? formatWhen(leg.departureAt)
      : typeof leg.departureTime === "string"
        ? leg.departureTime
        : leg.origin;
  const arrival =
    typeof leg.arrivalAt === "string" && leg.arrivalAt
      ? formatWhen(leg.arrivalAt)
      : typeof leg.arrivalTime === "string"
        ? leg.arrivalTime
        : leg.destination;
  const airline =
    typeof leg.airlineName === "string" && leg.airlineName
      ? leg.airlineName
      : typeof leg.airlineCode === "string" && leg.airlineCode
        ? leg.airlineCode
        : String(leg.origin);
  return {
    airline,
    flightNumber: typeof leg.flightNumber === "string" ? leg.flightNumber : "ROOM",
    origin: leg.origin,
    originCity: typeof leg.originCity === "string" ? leg.originCity : undefined,
    destination: leg.destination,
    destinationCity: typeof leg.destinationCity === "string" ? leg.destinationCity : undefined,
    departure,
    arrival,
    duration: asText(leg.durationLabel),
    cabin: asText(leg.cabin),
    baggage: asText(leg.baggage),
    aircraft: asText(leg.aircraft),
  };
}

function offerCabin(offer: unknown) {
  if (!offer || typeof offer !== "object") return undefined;
  const record = offer as Record<string, unknown>;
  return asText(record.cabinLabel) ?? asText(record.cabin);
}

function isMockFareCopy(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return false;
  return /^mock fare rules\b/i.test(text) || /\bmock (change|cancellation) fee\b/i.test(text);
}

function fareAmountLabel(currency: string | undefined, amount: number | null, fallbackLabel?: string) {
  if (currency && amount !== null) return money(currency, amount);
  const label = fallbackLabel?.trim() ?? "";
  if (!label || !/\d/.test(label)) return undefined;
  if (label.startsWith("৳")) {
    const rest = label.replace(/^৳\s*/, "").trim();
    return rest ? `${currency ?? "BDT"} ${rest}` : undefined;
  }
  return label;
}

function mapPenalties(rows: unknown[]): TicketPdfPenalty[] {
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const type = asText(item.type);
    const notes = asText(item.notes);
    const currency = asText(item.currency);
    const amount = asNumber(item.amount);
    const amountLabel = amount !== null && currency ? money(currency, amount) : amount !== null ? String(amount) : undefined;
    if (!type && !amountLabel && !notes) return [];
    return [{ type: type ?? "", amountLabel, notes }];
  });
}

function offerFareLines(fare: Record<string, unknown> | null): TicketPdfFareLine[] {
  if (!fare) return [];
  const currency = asText(fare.currency);
  if (!currency) return [];
  const lines: TicketPdfFareLine[] = [];
  const base = asNumber(fare.base);
  const taxes = asNumber(fare.taxes);
  const markup = asNumber(fare.markup);
  const serviceFee = asNumber(fare.serviceFee);
  const discount = asNumber(fare.discount);
  if (base !== null && base !== 0) lines.push({ label: "Base fare", amount: money(currency, base) });
  if (taxes !== null && taxes !== 0) lines.push({ label: "Taxes & surcharges", amount: money(currency, taxes) });
  if (markup !== null && markup !== 0) lines.push({ label: "Markup", amount: money(currency, markup) });
  if (serviceFee !== null && serviceFee !== 0) lines.push({ label: "Service fee", amount: money(currency, serviceFee) });
  if (discount !== null && discount !== 0) lines.push({ label: "Discount", amount: money(currency, discount) });
  const total = asNumber(fare.total);
  if (lines.length === 0) return [];
  const totalAmount = fareAmountLabel(currency, total, asText(fare.totalLabel));
  if (totalAmount) lines.push({ label: "Total", amount: totalAmount });
  return lines;
}

function offerFareSupport(offer: unknown) {
  if (!offer || typeof offer !== "object") return {};
  const record = offer as Record<string, unknown>;
  const fareRules = record.fareRules && typeof record.fareRules === "object" ? (record.fareRules as Record<string, unknown>) : null;
  const fare = record.fare && typeof record.fare === "object" ? (record.fare as Record<string, unknown>) : null;
  const penaltySource = Array.isArray(fareRules?.penalties) ? fareRules.penalties : Array.isArray(record.penalties) ? record.penalties : [];
  const penalties = mapPenalties(penaltySource).filter((row) => !isMockFareCopy(row.notes));
  const summary = asText(fareRules?.summary);
  const changeInfo = penalties
    .map((row) => [row.type, row.amountLabel, row.notes].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join("\n");
  return {
    fareRuleSummary: summary && !isMockFareCopy(summary) ? summary : undefined,
    changeInfo: changeInfo || undefined,
    refundable: asBool(fareRules?.refundable) ?? asBool(record.refundable),
    changeable: asBool(fareRules?.changeable),
    brandedFare: asText(record.brandedFare),
    penalties,
    fareLines: offerFareLines(fare),
  };
}

function ticketPdfInput(booking: BookingView, ticketNumber: string, passengerId: string | null): TicketPdfInput {
  const passenger = booking.passengers.find((row) => row.id === passengerId) ?? booking.passengers[0];
  const ticket = booking.tickets.find((row) => row.ticketNumber === ticketNumber);
  const flightOffer = booking.type === "HOTEL" ? null : booking.offer;
  const fare = flightOffer && "fare" in flightOffer ? (flightOffer.fare as Record<string, unknown>) : null;
  const itineraries =
    flightOffer && "itineraries" in flightOffer && Array.isArray(flightOffer.itineraries)
      ? flightOffer.itineraries
          .map((itinerary) => ({
            segments: itinerary.segments.map((leg) => offerSegment(leg)),
          }))
          .filter((group) => group.segments.length > 0)
      : [
          {
            segments: booking.segments.map((leg) => ({
              airline: leg.airlineCode,
              flightNumber: leg.flightNumber,
              origin: leg.origin,
              destination: leg.destination,
              departure: formatWhen(leg.departureAt),
              arrival: formatWhen(leg.arrivalAt),
              cabin: asText(leg.cabin),
            })),
          },
        ].filter((group) => group.segments.length > 0);

  return {
    bookingRef: booking.bookingRef,
    pnr: booking.providerRef || "PENDING",
    ticketNumber,
    ticketStatus: ticket?.status ?? "—",
    passengerName: passenger ? `${passenger.firstName} ${passenger.lastName}` : "Passenger",
    passengerType: passenger?.type ?? "ADULT",
    fareLabel:
      fareAmountLabel(asText(fare?.currency) ?? booking.currency, asNumber(fare?.total) ?? booking.totalAmount, asText(fare?.totalLabel)) ??
      `${booking.currency} ${booking.totalAmount.toLocaleString()}`,
    issuedAt: ticket?.issuedAt ? formatWhen(ticket.issuedAt) : "—",
    itineraries,
    cabin: offerCabin(flightOffer),
    ...offerFareSupport(flightOffer),
  };
}

function hotelVoucherPdfInput(booking: BookingView, voucherNumber: string, passengerId: string | null): HotelVoucherPdfInput {
  const guest = booking.passengers.find((row) => row.id === passengerId) ?? booking.passengers[0];
  const hotel = booking.hotel;
  return {
    bookingRef: booking.bookingRef,
    confirmation: booking.providerRef || "PENDING",
    voucherNumber,
    guestName: guest ? `${guest.firstName} ${guest.lastName}` : "Guest",
    guestType: guest?.type ?? "ADULT",
    hotelName: hotel?.name ?? "Hotel",
    address: hotel?.address ?? "",
    city: hotel?.city ?? "",
    roomName: hotel?.room.name ?? "Room",
    board: hotel?.board ?? "",
    checkIn: hotel?.checkIn ?? "",
    checkOut: hotel?.checkOut ?? "",
    nights: hotel?.nights ?? 1,
    fareLabel: booking.offer?.fare.totalLabel ?? `${booking.currency} ${booking.totalAmount.toLocaleString()}`,
    issuedAt: formatWhen(new Date().toISOString()),
  };
}

async function ensureTickets(booking: BookingView) {
  if (!booking.providerRef) {
    throw new DomainError("MISSING_PNR", "This booking has no supplier PNR.");
  }
  if (booking.passengers.length === 0) {
    throw new DomainError("NO_PASSENGERS", "Cannot ticket a booking with no travelers.");
  }

  const existing = await prisma.ticket.findMany({
    where: { bookingId: booking.id, status: "ISSUED" },
    orderBy: { issuedAt: "asc" },
  });
  if (existing.length >= booking.passengers.length) {
    return existing;
  }

  const isHotel = booking.type === "HOTEL";
  const providerId = isHotel ? getHotelProvider().id : getFlightProvider().id;
  const issuedNumbers = isHotel
    ? (
        await getHotelProvider().issueVoucher({
          providerRef: booking.providerRef,
          bookingId: booking.id,
          passengerCount: booking.passengers.length,
          correlationId: booking.id,
          idempotencyKey: `ticket:${booking.id}`,
        })
      ).voucherNumbers
    : (
        await getFlightProvider().issueTicket({
          providerRef: booking.providerRef,
          bookingId: booking.id,
          passengerCount: booking.passengers.length,
          correlationId: booking.id,
          idempotencyKey: `ticket:${booking.id}`,
        })
      ).ticketNumbers;
  if (issuedNumbers.length === 0) {
    throw new ProviderTicketingError({
      provider: providerId,
      operation: "issueTicket",
      correlationId: booking.id,
      unknownOutcome: true,
    });
  }
  return prisma.$transaction(async (tx) => {
    const created = [...existing];
    for (let index = 0; index < booking.passengers.length; index += 1) {
      const passenger = booking.passengers[index];
      if (created.some((row) => row.bookingPassengerId === passenger.id)) continue;
      const ticketNumber = issuedNumbers[index] ?? issuedNumbers[0];
      if (!ticketNumber) {
        throw new ProviderTicketingError({
          provider: providerId,
          operation: "issueTicket",
          correlationId: booking.id,
          unknownOutcome: true,
        });
      }
      const number = ticketNumber.slice(0, 32);
      let ticket;
      try {
        ticket = await tx.ticket.create({
          data: {
            bookingId: booking.id,
            bookingPassengerId: passenger.id,
            ticketNumber: number,
            status: "ISSUED",
            pdfUrl: pdfPath(booking.id, number),
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const existingTicket = await tx.ticket.findUnique({ where: { ticketNumber: number } });
        if (!existingTicket || existingTicket.bookingId !== booking.id) throw error;
        ticket = existingTicket;
      }
      await tx.bookingPassenger.update({
        where: { id: passenger.id },
        data: { ticketNumber: ticket.ticketNumber },
      });
      created.push(ticket);
    }
    return created;
  });
}

async function sendTicketEmail(booking: BookingView, tickets: Array<{ ticketNumber: string; bookingPassengerId: string | null }>) {
  const recipient = booking.contact?.email;
  if (!recipient) return { sent: false, provider: describeEmailProvider(), recipient: null as string | null };

  const attachments = [];
  for (const ticket of tickets) {
    const pdf = booking.type === "HOTEL"
      ? await buildHotelVoucherPdf(hotelVoucherPdfInput(booking, ticket.ticketNumber, ticket.bookingPassengerId))
      : await buildTicketPdf(ticketPdfInput(booking, ticket.ticketNumber, ticket.bookingPassengerId));
    attachments.push({
      filename: `ONETRIPS-${booking.bookingRef}-${ticket.ticketNumber}.pdf`,
      content: pdf,
      contentType: "application/pdf",
    });
  }

  try {
    const email = await enqueueNotification(
      {
        channel: "EMAIL",
        recipient,
        template: "ETICKET",
        payload: {
          bookingRef: booking.bookingRef,
          pnr: booking.providerRef ?? "",
          ticketNumbers: tickets.map((row) => row.ticketNumber).join(", "),
        },
        attachments,
      },
      booking.owner?.id ?? null,
    );
    if (booking.contact?.phone) {
      await enqueueNotification(
        {
          channel: "SMS",
          recipient: booking.contact.phone,
          template: "SMS_TICKETED",
          payload: { bookingRef: booking.bookingRef, pnr: booking.providerRef ?? "" },
        },
        booking.owner?.id ?? null,
      );
    }
    return {
      sent: email.sent || email.queued,
      queued: email.queued,
      provider: email.provider,
      recipient,
      sms: describeSmsProvider(),
    };
  } catch (error) {
    console.error("E-ticket notification failed", error);
    return { sent: false, queued: false, provider: describeEmailProvider(), recipient };
  }
}

async function tryIssueInvoice(bookingId: string) {
  try {
    await issueBookingInvoice(bookingId);
  } catch (error) {
    console.error("Invoice issue failed", error);
  }
}

export async function issueTickets(bookingId: string, actor: { id: string; type: string }) {
  try {
    await beginTicketing(bookingId, actor);
    let booking = await getBookingById(bookingId);
    if (booking.status === "TICKETED") {
      await tryIssueInvoice(bookingId);
      return { booking: await getBookingById(bookingId), email: { sent: true, provider: describeEmailProvider(), recipient: booking.contact?.email ?? null } };
    }

    const tickets = await ensureTickets(booking);
    booking = await getBookingById(bookingId);
    const email = await sendTicketEmail(booking, tickets);
    booking = await succeedTicketing(
      bookingId,
      actor,
      email.sent
        ? email.queued
          ? `E-tickets queued for ${email.recipient}`
          : `E-tickets emailed to ${email.recipient}`
        : "E-tickets issued",
    );
    await tryIssueInvoice(bookingId);
    return { booking: await getBookingById(bookingId), email };
  } catch (error) {
    try {
      const current = await getBookingById(bookingId);
      const issuedCount = await prisma.ticket.count({ where: { bookingId, status: "ISSUED" } });
      if (issuedCount > 0 && (current.status === "TICKETING_PENDING" || current.status === "TICKETED")) {
        if (current.status === "TICKETING_PENDING") {
          await succeedTicketing(bookingId, actor, "E-tickets issued");
          await tryIssueInvoice(bookingId);
        }
        return {
          booking: await getBookingById(bookingId),
          email: { sent: false, provider: describeEmailProvider(), recipient: null as string | null },
        };
      }
      if (current.status === "TICKETING_PENDING") {
        if (isUnknownProviderOutcome(error)) {
          await unknownTicketing(bookingId, actor, "Ticketing result is unconfirmed");
        } else {
          await failTicketing(bookingId, actor, error instanceof Error ? error.message : "Ticketing failed");
        }
      }
      return {
        booking: await getBookingById(bookingId),
        email: { sent: false, provider: describeEmailProvider(), recipient: null as string | null },
      };
    } catch {
      throw error;
    }
  }
}

export async function issueTicketsForCustomer(bookingId: string, userId: string) {
  await getBooking(bookingId, userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { type: true } });
  return issueTickets(bookingId, { id: userId, type: user?.type === "B2B" ? "B2B" : "CUSTOMER" });
}

export async function getTicketPdf(bookingId: string, ticketNumber: string, userId: string) {
  const booking = await getBooking(bookingId, userId);
  return buildIssuedTicketPdf(booking, ticketNumber);
}

export async function getTicketPdfAdmin(bookingId: string, ticketNumber: string) {
  const booking = await getBookingById(bookingId);
  return buildIssuedTicketPdf(booking, ticketNumber);
}

function buildIssuedTicketPdf(booking: BookingView, ticketNumber: string) {
  const ticket = booking.tickets.find((row) => row.ticketNumber === ticketNumber);
  if (!ticket) throw new DomainError("TICKET_NOT_FOUND", "Ticket not found.", 404);
  const bytesPromise =
    booking.type === "HOTEL"
      ? buildHotelVoucherPdf(hotelVoucherPdfInput(booking, ticket.ticketNumber, ticket.passengerId))
      : buildTicketPdf(ticketPdfInput(booking, ticket.ticketNumber, ticket.passengerId));
  return bytesPromise.then((pdf) => ({
    bytes: pdf,
    filename: `ONETRIPS-${booking.bookingRef}-${ticket.ticketNumber}.pdf`,
  }));
}

export async function voidIssuedTickets(bookingId: string) {
  const result = await prisma.ticket.updateMany({
    where: { bookingId, status: "ISSUED" },
    data: { status: "VOIDED", voidedAt: new Date() },
  });
  return { voided: result.count };
}

export async function resolveProviderOutcome(bookingId: string, actor: { id: string; type: string }) {
  let booking = await getBookingById(bookingId);
  if (booking.status === "BOOKING_UNKNOWN" || booking.status === "BOOKING_PENDING") {
    return { booking: await resolveSupplierBooking(bookingId, actor) };
  }
  if (booking.status !== "TICKETING_UNKNOWN") {
    return { booking };
  }
  const looked = booking.type === "HOTEL"
    ? await getHotelProvider().getBookingStatus({
        bookingId,
        providerRef: booking.providerRef ?? undefined,
        idempotencyKey: `ticket:${bookingId}`,
        correlationId: randomUUID(),
      })
    : await getFlightProvider().getBookingStatus({
        bookingId,
        providerRef: booking.providerRef ?? undefined,
        idempotencyKey: `ticket:${bookingId}`,
        correlationId: randomUUID(),
      });
  const issuedNumbers = "voucherNumbers" in looked ? looked.voucherNumbers : looked.ticketNumbers;
  if (issuedNumbers.length > 0 && booking.providerRef) {
    await ensureTickets({ ...booking, providerRef: booking.providerRef });
    await succeedTicketing(bookingId, actor, "Tickets confirmed with supplier");
    await tryIssueInvoice(bookingId);
    return { booking: await getBookingById(bookingId) };
  }
  if (looked.status === "FAILED") {
    await failTicketing(bookingId, actor, "Supplier confirmed ticketing failed");
  }
  return { booking: await getBookingById(bookingId) };
}
