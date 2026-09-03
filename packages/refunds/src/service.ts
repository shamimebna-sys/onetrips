import { prisma } from "@onetrips/database";
import {
  cancelBookingRecord,
  completeRefund,
  getBooking,
  getBookingById,
  startRefund,
} from "@onetrips/booking";
import { DomainError } from "@onetrips/shared";
import { getFlightProvider } from "@onetrips/flight-search";
import { getHotelProvider } from "@onetrips/hotel-search";
import { randomUUID } from "node:crypto";
import { enqueueNotification } from "@onetrips/notifications";
import { expireOpenPayments, refundCapturedPayments, remainingRefundable } from "@onetrips/payments";
import { reverseBookingWalletDebits, voidBookingInvoices } from "@onetrips/finance";
import { releasePromoForBooking } from "@onetrips/promotions";
import { voidIssuedTickets } from "@onetrips/ticketing";
import { cancelSchema, refundSchema } from "./schemas";

type Actor = { id: string; type: string };

const PNR_STATES = new Set(["BOOKED", "TICKETING_PENDING", "TICKETING_FAILED", "TICKETED", "BOOKING_FAILED"]);

async function load(bookingId: string, actor: Actor) {
  if (actor.type === "CUSTOMER") return getBooking(bookingId, actor.id);
  return getBookingById(bookingId);
}

async function capturedPaymentCount(bookingId: string) {
  return prisma.payment.count({
    where: {
      bookingId,
      status: { in: ["SUCCESS", "REFUND_INITIATED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
  });
}

async function audit(actor: Actor, action: string, bookingId: string, previous: string, next: string, reason?: string) {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id === "gateway" ? undefined : actor.id,
      actorType: actor.type.slice(0, 32),
      action,
      entityType: "Booking",
      entityId: bookingId,
      previousState: { status: previous },
      newState: { status: next },
      reason: reason?.slice(0, 255),
    },
  });
}

async function notify(booking: Awaited<ReturnType<typeof getBookingById>>, template: "BOOKING_CANCELLED" | "BOOKING_REFUNDED", extra: Record<string, unknown> = {}) {
  const email = booking.contact?.email;
  const payload = {
    bookingRef: booking.bookingRef,
    status: booking.status,
    currency: booking.currency,
    amount: String(booking.totalAmount),
    pnr: booking.providerRef ?? "",
    ...extra,
  };
  if (email) {
    void enqueueNotification(
      { channel: "EMAIL", recipient: email, template, payload },
      booking.owner?.id ?? null,
    ).catch((error) => console.error("Cancel notification failed", error));
  }
  if (booking.contact?.phone && template === "BOOKING_CANCELLED") {
    void enqueueNotification(
      {
        channel: "SMS",
        recipient: booking.contact.phone,
        template: "SMS_CANCELLED",
        payload: { bookingRef: booking.bookingRef, status: booking.status },
      },
      booking.owner?.id ?? null,
    ).catch((error) => console.error("Cancel SMS failed", error));
  }
}

async function cancelSupplierHold(booking: Awaited<ReturnType<typeof getBookingById>>) {
  if (!booking.providerRef || !PNR_STATES.has(booking.status)) return;
  const correlationId = randomUUID();
  if (booking.type === "HOTEL") {
    const result = await getHotelProvider().cancelBooking({
      providerRef: booking.providerRef,
      bookingId: booking.id,
      correlationId,
      idempotencyKey: `cancel:${booking.id}`,
    });
    if (!result.cancelled) {
      throw new DomainError("SUPPLIER_CANCEL_FAILED", "The supplier could not cancel this reservation.");
    }
    return;
  }
  for (const ticket of booking.tickets.filter((row) => row.status === "ISSUED")) {
    await getFlightProvider().voidTicket({
      providerRef: booking.providerRef,
      ticketNumber: ticket.ticketNumber,
      bookingId: booking.id,
      correlationId,
      idempotencyKey: `void:${booking.id}:${ticket.ticketNumber}`,
    });
  }
  const result = await getFlightProvider().cancelBooking({
    providerRef: booking.providerRef,
    bookingId: booking.id,
    correlationId,
    idempotencyKey: `cancel:${booking.id}`,
  });
  if (!result.cancelled) {
    throw new DomainError("SUPPLIER_CANCEL_FAILED", "The supplier could not cancel this reservation.");
  }
}

async function settleRefund(bookingId: string, actor: Actor, reason?: string, amount?: number) {
  await startRefund(bookingId, actor, reason);
  const result = await refundCapturedPayments(bookingId, actor, amount);
  await reverseBookingWalletDebits(bookingId, actor.id);
  if (result.remaining <= 0.009) {
    await completeRefund(bookingId, actor, reason ?? "Refund completed");
  }
  const booking = await getBookingById(bookingId);
  if (booking.status === "REFUNDED") {
    await notify(booking, "BOOKING_REFUNDED", { refunded: String(result.refunded) });
  }
  return { booking, refund: result };
}

export async function cancelBooking(bookingId: string, actor: Actor, input: unknown = {}) {
  const data = cancelSchema.parse(input ?? {});
  const booking = await load(bookingId, actor);

  if (booking.status === "PAYMENT_PROCESSING") {
    throw new DomainError("INVALID_STATUS", "Wait for the payment attempt to finish before cancelling.");
  }
  if (booking.status === "EXPIRED") {
    throw new DomainError("INVALID_STATUS", "An expired hold cannot be cancelled.");
  }
  if (booking.status === "REFUNDED") {
    return { booking, settlement: "already-refunded" as const };
  }
  const captured = await capturedPaymentCount(bookingId);
  if (booking.status === "CANCELLED" && captured === 0) {
    return { booking, settlement: "cancelled" as const };
  }
  if (!booking.next.canCancel && booking.status !== "CANCELLED" && booking.status !== "REFUND_PENDING") {
    throw new DomainError("INVALID_STATUS", `This booking cannot be cancelled from ${booking.status}.`);
  }
  const shouldRefund = (data.refund ?? true) && captured > 0;

  if (booking.status !== "CANCELLED" && booking.status !== "REFUND_PENDING") {
    await cancelSupplierHold(booking);
    await voidIssuedTickets(bookingId);
    await expireOpenPayments(bookingId);
    await cancelBookingRecord(bookingId, actor, data.reason);
    await releasePromoForBooking(bookingId);
    await voidBookingInvoices(bookingId);
    await audit(actor, "BOOKING_CANCEL", bookingId, booking.status, shouldRefund ? "REFUND_PENDING" : "CANCELLED", data.reason);
  }

  if (shouldRefund) {
    const next = await getBookingById(bookingId);
    await notify(next, "BOOKING_CANCELLED");
    const settled = await settleRefund(bookingId, actor, data.reason);
    return { booking: settled.booking, settlement: settled.booking.status === "REFUNDED" ? ("refunded" as const) : ("refund-pending" as const), refund: settled.refund };
  }

  const next = await getBookingById(bookingId);
  await notify(next, "BOOKING_CANCELLED");
  return { booking: next, settlement: "cancelled" as const };
}

export async function cancelBookingForCustomer(bookingId: string, userId: string, input: unknown = {}) {
  return cancelBooking(bookingId, { id: userId, type: "CUSTOMER" }, { ...(typeof input === "object" && input ? input : {}), refund: true });
}

export async function refundBooking(bookingId: string, actor: Actor, input: unknown = {}) {
  const data = refundSchema.parse(input ?? {});
  const booking = await load(bookingId, actor);

  if (booking.status === "REFUNDED") {
    return { booking, settlement: "already-refunded" as const };
  }

  if (booking.next.canCancel && booking.status !== "CANCELLED" && booking.status !== "REFUND_PENDING" && booking.status !== "BOOKING_FAILED") {
    return cancelBooking(bookingId, actor, { reason: data.reason, refund: true });
  }

  if (!booking.next.canRefund && booking.status !== "REFUND_PENDING") {
    throw new DomainError("INVALID_STATUS", "This booking is not ready for a refund.");
  }

  const remaining = await remainingRefundable(bookingId);
  if (remaining <= 0 && booking.status !== "REFUND_PENDING" && booking.status !== "BOOKING_FAILED") {
    throw new DomainError("NOTHING_TO_REFUND", "There is no captured payment left to refund.");
  }

  if (booking.status === "BOOKING_FAILED" || booking.status === "CANCELLED") {
    await voidIssuedTickets(bookingId);
    await voidBookingInvoices(bookingId);
  }

  const settled = await settleRefund(bookingId, actor, data.reason, data.amount);
  await audit(actor, "BOOKING_REFUND", bookingId, booking.status, settled.booking.status, data.reason);
  return {
    booking: settled.booking,
    settlement: settled.booking.status === "REFUNDED" ? ("refunded" as const) : ("refund-pending" as const),
    refund: settled.refund,
  };
}

export async function refundBookingForCustomer(bookingId: string, userId: string, input: unknown = {}) {
  const booking = await getBooking(bookingId, userId);
  if (booking.status !== "BOOKING_FAILED" && booking.status !== "CANCELLED" && booking.status !== "REFUND_PENDING") {
    throw new DomainError("INVALID_STATUS", "Request a cancellation first, or wait if a reservation failed.");
  }
  return refundBooking(bookingId, { id: userId, type: "CUSTOMER" }, input);
}
