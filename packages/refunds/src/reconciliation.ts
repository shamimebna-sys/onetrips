import { prisma } from "@onetrips/database";
import { refundedAgainstPayment } from "@onetrips/finance";

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

export type ReconciliationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  bookingId: string;
  bookingRef: string;
  paymentId?: string;
  invoiceId?: string;
};

export async function getReconciliationReport(take = 80) {
  const [payments, bookings, invoices, payCredits] = await Promise.all([
    prisma.payment.findMany({
      where: { status: { in: ["SUCCESS", "REFUND_INITIATED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      include: { booking: { select: { id: true, bookingRef: true, status: true, totalAmount: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    }),
    prisma.booking.findMany({
      where: { status: { in: ["CANCELLED", "REFUND_PENDING", "REFUNDED", "BOOKING_FAILED", "TICKETED", "BOOKED", "BOOKING_UNKNOWN", "TICKETING_UNKNOWN", "TICKETING_FAILED"] } },
      include: {
        payments: true,
        tickets: { select: { status: true } },
        invoices: { select: { id: true, status: true, total: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "PAID"] } },
      include: { booking: { select: { id: true, bookingRef: true, status: true, payments: { select: { status: true, amount: true } } } } },
      take: Math.min(Math.max(take, 1), 200),
      orderBy: { createdAt: "desc" },
    }),
    prisma.ledgerEntry.findMany({
      where: { reference: { startsWith: "PAY-" } },
      select: { reference: true, amount: true, paymentId: true },
    }),
  ]);

  const issues: ReconciliationIssue[] = [];
  const creditByPayment = new Map(payCredits.filter((row) => row.paymentId).map((row) => [row.paymentId as string, money(row.amount)]));

  for (const payment of payments) {
    const booking = payment.booking;
    const captured = money(payment.amount);
    if (payment.status === "SUCCESS" && !creditByPayment.has(payment.id)) {
      issues.push({
        severity: "error",
        code: "MISSING_PAY_CREDIT",
        message: `Payment ${payment.id.slice(-8)} is SUCCESS but ledger PAY-${payment.id} is missing.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentId: payment.id,
      });
    }
    if (payment.status === "SUCCESS" && (booking.status === "PAYMENT_PENDING" || booking.status === "PAYMENT_PROCESSING")) {
      issues.push({
        severity: "error",
        code: "PAYMENT_SUCCESS_BOOKING_PENDING",
        message: `Payment is SUCCESS but booking ${booking.bookingRef} is still ${booking.status}.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentId: payment.id,
      });
    }
    if (payment.status === "SUCCESS" && Math.abs(captured - money(booking.totalAmount)) > 1) {
      issues.push({
        severity: "warning",
        code: "AMOUNT_MISMATCH",
        message: `Captured ${captured} does not match booking total ${money(booking.totalAmount)}.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentId: payment.id,
      });
    }
    const refunded = await refundedAgainstPayment(payment.id);
    if (
      (booking.status === "CANCELLED" || booking.status === "BOOKING_FAILED" || booking.status === "REFUND_PENDING") &&
      payment.status === "SUCCESS"
    ) {
      issues.push({
        severity: "error",
        code: "UNREFUNDED_CAPTURE",
        message: `Booking ${booking.bookingRef} is ${booking.status} but payment is still SUCCESS.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentId: payment.id,
      });
    }
    if (booking.status === "REFUNDED" && payment.status !== "REFUNDED") {
      issues.push({
        severity: "error",
        code: "BOOKING_REFUNDED_PAYMENT_OPEN",
        message: `Booking is REFUNDED but payment is ${payment.status}.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentId: payment.id,
      });
    }
    if (payment.status === "REFUNDED" && refunded + 0.009 < captured) {
      issues.push({
        severity: "warning",
        code: "REFUND_LEDGER_SHORT",
        message: `Payment marked REFUNDED but ledger refunds ${refunded} of ${captured}.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentId: payment.id,
      });
    }
  }

  for (const booking of bookings) {
    if ((booking.status === "BOOKED" || booking.status === "TICKETED") && !booking.providerRef) {
      issues.push({
        severity: "error",
        code: "MISSING_PNR",
        message: `Booking ${booking.bookingRef} is ${booking.status} without a supplier PNR.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
      });
    }
    if (booking.status === "TICKETED" && !booking.tickets.some((ticket) => ticket.status === "ISSUED")) {
      issues.push({
        severity: "error",
        code: "TICKETED_WITHOUT_TICKETS",
        message: `Booking ${booking.bookingRef} is TICKETED but has no issued tickets.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
      });
    }
    if (booking.status === "BOOKING_UNKNOWN" || booking.status === "TICKETING_UNKNOWN") {
      issues.push({
        severity: "warning",
        code: "UNKNOWN_PROVIDER_OUTCOME",
        message: `Booking ${booking.bookingRef} is ${booking.status}; confirm against the supplier before retrying.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
      });
    }
    if (booking.status === "REFUNDED" && booking.tickets.some((ticket) => ticket.status === "ISSUED")) {
      issues.push({
        severity: "warning",
        code: "ISSUED_TICKET_AFTER_REFUND",
        message: `Refunded booking ${booking.bookingRef} still has ISSUED tickets.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
      });
    }
    if (
      (booking.status === "CANCELLED" || booking.status === "REFUNDED") &&
      booking.invoices.some((invoice) => invoice.status === "PAID" || invoice.status === "ISSUED")
    ) {
      issues.push({
        severity: "warning",
        code: "LIVE_INVOICE_AFTER_CANCEL",
        message: `Cancelled/refunded booking ${booking.bookingRef} still has a live invoice.`,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        invoiceId: booking.invoices.find((invoice) => invoice.status === "PAID" || invoice.status === "ISSUED")?.id,
      });
    }
  }

  for (const invoice of invoices) {
    if (!invoice.booking) continue;
    const paid = invoice.booking.payments
      .filter((row) => row.status === "SUCCESS" || row.status === "REFUNDED" || row.status === "PARTIALLY_REFUNDED")
      .reduce((sum, row) => sum + money(row.amount), 0);
    if (invoice.status === "PAID" && Math.abs(paid - money(invoice.total)) > 1 && invoice.booking.status !== "REFUNDED") {
      issues.push({
        severity: "warning",
        code: "INVOICE_PAYMENT_MISMATCH",
        message: `Invoice ${invoice.invoiceNo} PAID ${money(invoice.total)} vs payments ${paid}.`,
        bookingId: invoice.booking.id,
        bookingRef: invoice.booking.bookingRef,
        invoiceId: invoice.id,
      });
    }
    if (invoice.status === "PAID" && invoice.booking.status === "REFUNDED") {
      issues.push({
        severity: "error",
        code: "PAID_INVOICE_ON_REFUND",
        message: `Invoice ${invoice.invoiceNo} is still PAID after the booking was refunded.`,
        bookingId: invoice.booking.id,
        bookingRef: invoice.booking.bookingRef,
        invoiceId: invoice.id,
      });
    }
  }

  const errors = issues.filter((row) => row.severity === "error").length;
  return {
    generatedAt: new Date().toISOString(),
    scanned: { payments: payments.length, bookings: bookings.length, invoices: invoices.length },
    errors,
    warnings: issues.length - errors,
    balanced: issues.length === 0,
    issues,
  };
}
