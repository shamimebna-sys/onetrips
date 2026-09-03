import { randomUUID } from "node:crypto";
import { prisma } from "@onetrips/database";
import type { PaymentStatus } from "@onetrips/database";
import { DomainError, canPaymentTransition, type CurrencyCode, type PaymentState } from "@onetrips/shared";
import { beginPayment, failPayment, getBooking, getBookingById, succeedPayment } from "@onetrips/booking";
import { issueTickets } from "@onetrips/ticketing";
import { enqueueNotification } from "@onetrips/notifications";
import { refundedAgainstPayment, reverseGatewayCredit, assertCanDebit, debitWallet } from "@onetrips/finance";
import { getMembership } from "@onetrips/organization";
import { commitPromoForBooking } from "@onetrips/promotions";
import { MockPaymentProvider, getMockSession, setMockOutcome, signedWebhookBody } from "./adapters/mock";
import { initiatePaymentSchema } from "./schemas";
import type { PaymentMethod, PaymentProviderPort, PaymentWebhookPayload } from "./types";

function asPayState(status: PaymentStatus): PaymentState {
  return status as PaymentState;
}

function getProvider(): PaymentProviderPort {
  return new MockPaymentProvider();
}

function movePayment(from: PaymentStatus, to: PaymentStatus) {
  if (!canPaymentTransition(asPayState(from), asPayState(to))) {
    throw new DomainError("ILLEGAL_TRANSITION", `Cannot move payment from ${from} to ${to}.`);
  }
}

async function recordAttempt(paymentId: string, status: PaymentStatus, providerRef: string | null, response?: unknown) {
  const count = await prisma.paymentAttempt.count({ where: { paymentId } });
  await prisma.paymentAttempt.create({
    data: {
      paymentId,
      attemptNo: count + 1,
      providerRef,
      status,
      providerResponse: response ? (response as object) : undefined,
    },
  });
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function creditWallet(userId: string, paymentId: string, bookingId: string, amount: number, currency: string) {
  const wallet = await prisma.wallet.upsert({
    where: { ownerId_ownerType_currency: { ownerId: userId, ownerType: "CUSTOMER", currency } },
    update: {},
    create: { ownerId: userId, ownerType: "CUSTOMER", currency, status: "ACTIVE" },
  });
  try {
    await prisma.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        bookingId,
        paymentId,
        type: "CREDIT",
        amount,
        currency,
        reference: `PAY-${paymentId}`,
        actorId: userId,
        note: "Customer flight payment",
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function initiatePayment(bookingId: string, userId: string, input: unknown) {
  const data = initiatePaymentSchema.parse(input ?? {});
  const booking = await getBooking(bookingId, userId);
  const actor = { id: userId, type: "CUSTOMER" };
  const idempotencyKey = data.idempotencyKey ?? `booking:${bookingId}:pay`;
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });

  if (booking.next.paid || booking.status === "BOOKED" || booking.status === "BOOKING_FAILED") {
    if (existing?.status === "SUCCESS" && existing.providerRef) {
      const result = await applyGatewayResult(existing.providerRef, "SUCCESS", actor);
      return { ...result, redirectUrl: null as string | null };
    }
    return { booking, payment: existing, redirectUrl: null as string | null };
  }

  if (!booking.next.canPay && booking.status !== "PAYMENT_PROCESSING") {
    throw new DomainError("INVALID_STATUS", "This booking is not ready for payment.");
  }
  if (existing?.status === "SUCCESS") {
    if (!existing.providerRef) {
      return { booking, payment: existing, redirectUrl: null as string | null };
    }
    const result = await applyGatewayResult(existing.providerRef, "SUCCESS", actor);
    return { ...result, redirectUrl: null as string | null };
  }
  if (existing?.status === "PROCESSING" && existing.providerRef) {
    const verified = await getProvider().verify(existing.providerRef);
    if (verified.status === "SUCCESS" || verified.status === "FAILED") {
      return applyGatewayResult(existing.providerRef, verified.status, actor);
    }
    if (getMockSession(existing.providerRef)) {
      const origin = appUrl();
      return {
        booking,
        payment: existing,
        redirectUrl: `${origin}/pay/sandbox?ref=${existing.providerRef}&amount=${existing.amount}&currency=${existing.currency}&booking=${booking.bookingRef}&return=${encodeURIComponent(`${origin}/booking/${bookingId}/return?paymentId=${existing.id}`)}`,
      };
    }
  }

  const amount = booking.totalAmount;
  const currency = (booking.currency || "BDT") as CurrencyCode;
  let payment = existing;
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        bookingId,
        amount,
        currency,
        status: "PENDING",
        method: data.method,
        idempotencyKey,
      },
    });
  }

  await beginPayment(bookingId, actor);
  const returnUrl = `${appUrl()}/booking/${bookingId}/return?paymentId=${payment.id}`;
  const initiated = await getProvider().initiate({
    bookingId,
    bookingRef: booking.bookingRef,
    amount: { amount: String(amount), currency },
    idempotencyKey,
    returnUrl,
    method: data.method as PaymentMethod,
  });

  if (payment.status !== "PROCESSING") {
    movePayment(payment.status === "FAILED" ? "FAILED" : "PENDING", "PROCESSING");
  }
  payment = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PROCESSING", providerRef: initiated.providerRef, method: data.method },
  });
  await recordAttempt(payment.id, "PROCESSING", initiated.providerRef, { redirectUrl: initiated.redirectUrl });

  return { booking: await getBooking(bookingId, userId), payment, redirectUrl: initiated.redirectUrl };
}

async function applyGatewayResult(providerRef: string, status: "SUCCESS" | "FAILED", actor: { id: string; type: string }) {
  const payment = await prisma.payment.findFirst({ where: { providerRef }, orderBy: { createdAt: "desc" } });
  if (!payment) throw new DomainError("PAYMENT_NOT_FOUND", "Payment not found.", 404);

  if (payment.status === "FAILED" && status === "FAILED") {
    return { booking: await getBookingById(payment.bookingId), payment };
  }

  const bookingRow = await prisma.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
  if (status === "SUCCESS") {
    if (payment.status !== "SUCCESS") {
      movePayment(payment.status, "SUCCESS");
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });
      await recordAttempt(payment.id, "SUCCESS", providerRef);
    }
    if (bookingRow.userId && !bookingRow.organizationId) {
      await creditWallet(bookingRow.userId, payment.id, payment.bookingId, Number(payment.amount), payment.currency);
    }
    const booking = await succeedPayment(payment.bookingId, actor);
    await commitPromoForBooking(payment.bookingId);
    if (booking.contact?.email) {
      void enqueueNotification(
        {
          channel: "EMAIL",
          recipient: booking.contact.email,
          template: "PAYMENT_SUCCESS",
          payload: {
            bookingRef: booking.bookingRef,
            amount: String(booking.totalAmount),
            currency: booking.currency,
          },
        },
        booking.owner?.id ?? null,
      ).catch((error) => console.error("Payment notification failed", error));
    }
    if (booking.status === "BOOKED" || booking.status === "TICKETING_PENDING" || booking.status === "TICKETING_FAILED") {
      try {
        const ticketed = await issueTickets(payment.bookingId, actor);
        return { booking: ticketed.booking, payment: { ...payment, status: "SUCCESS" as const } };
      } catch {
        return { booking, payment: { ...payment, status: "SUCCESS" as const } };
      }
    }
    return { booking, payment: { ...payment, status: "SUCCESS" as const } };
  }

  if (payment.status === "SUCCESS") {
    throw new DomainError("INVALID_STATUS", "A successful payment cannot be marked failed.");
  }
  if (payment.status !== "FAILED") {
    movePayment(payment.status, "FAILED");
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    await recordAttempt(payment.id, "FAILED", providerRef);
  }
  const booking = await failPayment(payment.bookingId, actor, "Gateway declined the payment");
  return { booking, payment: { ...payment, status: "FAILED" as const } };
}

export async function handleWebhook(rawBody: string, signature: string | null) {
  const provider = getProvider();
  const payload = provider.parseWebhook(rawBody, signature);
  const idempotencyKey = `${provider.id}:${payload.eventId}`;

  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: provider.id,
        eventId: payload.eventId,
        payload: payload as object,
        signature: signature?.slice(0, 255),
        status: "RECEIVED",
        idempotencyKey,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.paymentWebhookEvent.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "PROCESSED") {
      return { duplicate: true, eventId: payload.eventId };
    }
    const payment = await prisma.payment.findFirst({
      where: { providerRef: payload.providerRef },
      orderBy: { createdAt: "desc" },
    });
    if (payment && (payment.status === "SUCCESS" || payment.status === payload.status)) {
      await prisma.paymentWebhookEvent.updateMany({
        where: { idempotencyKey, status: { not: "PROCESSED" } },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return { duplicate: true, eventId: payload.eventId };
    }
  }

  const result = await applyGatewayResult(payload.providerRef, payload.status, { id: "gateway", type: "SYSTEM" });
  await prisma.paymentWebhookEvent.update({
    where: { idempotencyKey },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
  return { duplicate: false, eventId: payload.eventId, booking: result.booking };
}

export async function verifyPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new DomainError("PAYMENT_NOT_FOUND", "Payment not found.", 404);
  const booking = await getBooking(payment.bookingId, userId);
  if (!payment.providerRef) return { booking, payment };

  const verified = await getProvider().verify(payment.providerRef);
  if (verified.status === "PENDING") return { booking, payment };
  const result = await applyGatewayResult(payment.providerRef, verified.status, { id: userId, type: "CUSTOMER" });
  return result;
}

export async function completeSandboxPayment(providerRef: string, outcome: "SUCCESS" | "FAILED") {
  if (process.env.NODE_ENV === "production") {
    throw new DomainError("NOT_FOUND", "Sandbox payments are disabled.", 404);
  }
  const session = getMockSession(providerRef);
  if (!session) throw new DomainError("PAYMENT_NOT_FOUND", "Unknown payment session.", 404);
  setMockOutcome(providerRef, outcome);
  const payload: PaymentWebhookPayload = {
    eventId: randomUUID(),
    providerRef,
    status: outcome,
    amount: session.amount,
    currency: session.currency,
  };
  const signed = signedWebhookBody(payload);
  return handleWebhook(signed.raw, signed.signature);
}

export function sandboxSession(providerRef: string) {
  if (process.env.NODE_ENV === "production") return null;
  return getMockSession(providerRef);
}

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

export async function expireOpenPayments(bookingId: string) {
  const open = await prisma.payment.findMany({
    where: { bookingId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  for (const payment of open) {
    movePayment(payment.status, "EXPIRED");
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "EXPIRED" } });
    await recordAttempt(payment.id, "EXPIRED", payment.providerRef);
  }
  return open.length;
}

async function toRefundInitiated(paymentId: string, status: PaymentStatus) {
  if (status === "REFUND_INITIATED") return "REFUND_INITIATED" as const;
  if (status === "SUCCESS" || status === "PARTIALLY_REFUNDED") {
    movePayment(status, "REFUND_INITIATED");
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUND_INITIATED" } });
    return "REFUND_INITIATED" as const;
  }
  return status;
}

export async function remainingRefundable(bookingId: string) {
  const rows = await prisma.payment.findMany({
    where: { bookingId, status: { in: ["SUCCESS", "REFUND_INITIATED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
  });
  let remaining = 0;
  for (const row of rows) {
    if (row.status === "REFUNDED") continue;
    remaining += Math.max(0, money(row.amount) - (await refundedAgainstPayment(row.id)));
  }
  return Math.round(remaining * 100) / 100;
}

export async function refundCapturedPayments(
  bookingId: string,
  actor: { id: string; type: string },
  amount?: number,
) {
  const payments = await prisma.payment.findMany({
    where: {
      bookingId,
      status: { in: ["SUCCESS", "REFUND_INITIATED", "PARTIALLY_REFUNDED"] },
    },
    orderBy: { createdAt: "asc" },
  });
  if (payments.length === 0) {
    const already = await prisma.payment.findMany({ where: { bookingId, status: "REFUNDED" } });
    return { refunded: 0, remaining: 0, payments: already };
  }

  let remainingRequest = amount != null ? money(amount) : null;
  const updated = [];
  let refundedNow = 0;

  for (const payment of payments) {
    const captured = money(payment.amount);
    const already = await refundedAgainstPayment(payment.id);
    const leftover = Math.round((captured - already) * 100) / 100;
    if (leftover <= 0) {
      await toRefundInitiated(payment.id, payment.status);
      movePayment("REFUND_INITIATED", "REFUNDED");
      updated.push(await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } }));
      continue;
    }

    const slice = remainingRequest == null ? leftover : Math.min(leftover, remainingRequest);
    if (slice <= 0) {
      updated.push(payment);
      continue;
    }

    await toRefundInitiated(payment.id, payment.status);

    let refundRef = `RF${payment.id.slice(-8)}`;
    if (payment.providerRef) {
      const result = await getProvider().refund(
        payment.providerRef,
        { amount: String(slice), currency: payment.currency as CurrencyCode },
        `rf:${payment.id}:${Math.round(already * 100)}`,
      );
      refundRef = result.refundRef;
    }

    await reverseGatewayCredit(payment.id, slice, actor.id);
    const fully = leftover - slice <= 0.009;
    await recordAttempt(payment.id, fully ? "REFUNDED" : "PARTIALLY_REFUNDED", payment.providerRef, {
      refundRef,
      amount: slice,
    });
    const nextStatus = fully ? "REFUNDED" : "PARTIALLY_REFUNDED";
    movePayment("REFUND_INITIATED", nextStatus);
    updated.push(await prisma.payment.update({ where: { id: payment.id }, data: { status: nextStatus } }));
    refundedNow += slice;
    if (remainingRequest != null) remainingRequest = Math.round((remainingRequest - slice) * 100) / 100;
  }

  if (amount != null && remainingRequest != null && remainingRequest > 0.009) {
    throw new DomainError("REFUND_TOO_LARGE", "Refund amount is larger than the remaining captured payment.");
  }

  return {
    refunded: Math.round(refundedNow * 100) / 100,
    remaining: await remainingRefundable(bookingId),
    payments: updated,
  };
}

export async function payWithOrganizationWallet(bookingId: string, userId: string) {
  const booking = await getBooking(bookingId, userId);
  if (!booking.organization) {
    throw new DomainError("INVALID_CHANNEL", "Organization wallet settlement is only for B2B bookings.");
  }
  const membership = await getMembership(userId);
  if (membership.organizationId !== booking.organization.id) {
    throw new DomainError("FORBIDDEN", "You cannot charge another organization's wallet.", 403);
  }
  if (membership.organization.status !== "ACTIVE") {
    throw new DomainError("ORG_INACTIVE", "Agency is not active for spending.", 403);
  }

  const amount = booking.totalAmount;
  const currency = (booking.currency || "BDT") as CurrencyCode;
  const actor = { id: userId, type: "B2B" };
  const idempotencyKey = `booking:${bookingId}:wallet`;
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });

  if (booking.next.paid || booking.status === "BOOKED" || booking.status === "TICKETED") {
    return {
      booking: await getBooking(bookingId, userId),
      payment: existing,
      redirectUrl: null as string | null,
      settlement: "ORGANIZATION_WALLET" as const,
    };
  }

  if (!booking.next.canPay && booking.status !== "PAYMENT_PROCESSING") {
    throw new DomainError("INVALID_STATUS", "This booking is not ready for payment.");
  }

  if (existing?.status === "SUCCESS") {
    const booked = await succeedPayment(bookingId, actor);
    await commitPromoForBooking(bookingId);
    return {
      booking: booked,
      payment: existing,
      redirectUrl: null as string | null,
      settlement: "ORGANIZATION_WALLET" as const,
    };
  }

  await assertCanDebit(membership.organizationId, "ORGANIZATION", amount, currency);
  await beginPayment(bookingId, actor);

  let payment = existing;
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        bookingId,
        amount,
        currency,
        status: "PROCESSING",
        method: "WALLET",
        idempotencyKey,
        providerRef: `WALLET-${booking.bookingRef}`,
      },
    });
  } else if (payment.status !== "PROCESSING") {
    movePayment(payment.status === "FAILED" ? "FAILED" : payment.status, "PROCESSING");
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PROCESSING", method: "WALLET", providerRef: payment.providerRef ?? `WALLET-${booking.bookingRef}` },
    });
  }
  await recordAttempt(payment.id, "PROCESSING", payment.providerRef, { settlement: "ORGANIZATION_WALLET" });

  try {
    await debitWallet(membership.organizationId, "ORGANIZATION", userId, {
      amount,
      currency,
      reference: `BKG-${booking.bookingRef}`,
      bookingId,
      paymentId: payment.id,
      note: `B2B wallet/credit debit for ${booking.bookingRef} (replaces gateway payment)`,
    });
  } catch (error) {
    await failPayment(bookingId, actor, "Wallet or credit authorization failed");
    if (payment.status !== "FAILED") {
      movePayment("PROCESSING", "FAILED");
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    }
    await recordAttempt(payment.id, "FAILED", payment.providerRef, {
      reason: error instanceof Error ? error.message : "Wallet debit failed",
    });
    throw error;
  }

  if (payment.status !== "SUCCESS") {
    movePayment("PROCESSING", "SUCCESS");
    payment = await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });
  }
  await recordAttempt(payment.id, "SUCCESS", payment.providerRef, { settlement: "ORGANIZATION_WALLET" });

  let next = await succeedPayment(bookingId, actor);
  await commitPromoForBooking(bookingId);
  if (next.status === "BOOKED" || next.status === "TICKETING_PENDING" || next.status === "TICKETING_FAILED") {
    try {
      const ticketed = await issueTickets(bookingId, actor);
      next = ticketed.booking;
    } catch {
      next = await getBooking(bookingId, userId);
    }
  }

  return {
    booking: next,
    payment,
    redirectUrl: null as string | null,
    settlement: "ORGANIZATION_WALLET" as const,
  };
}
