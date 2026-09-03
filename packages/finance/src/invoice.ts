import { randomUUID } from "node:crypto";
import { prisma } from "@onetrips/database";
import type { InvoiceStatus } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { buildInvoicePdf } from "./invoice-pdf";
import { canonicalInvoiceTotals, routeFromSegments } from "./invoice-mapping";

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function invoiceNo() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${day}-${randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

type FareSnap = {
  supplierBase?: number;
  supplierTaxes?: number;
  base?: number;
  taxes?: number;
  markup?: number;
  serviceFee?: number;
  discount?: number;
};

function snapshotFare(snapshot: unknown): FareSnap | null {
  if (!snapshot || typeof snapshot !== "object" || !("offer" in snapshot)) return null;
  const offer = (snapshot as { offer?: { fare?: FareSnap } }).offer;
  return offer?.fare ?? null;
}

function lineItems(booking: {
  totalAmount: { toString(): string } | number;
  supplierCost: { toString(): string } | number | null;
  markupAmount: { toString(): string } | number | null;
  serviceFee: { toString(): string } | number | null;
  discountAmount: { toString(): string } | number | null;
  snapshot: unknown;
}) {
  const fare = snapshotFare(booking.snapshot);
  const supplierBase = fare?.supplierBase ?? fare?.base ?? money(booking.supplierCost);
  const supplierTaxes = fare?.supplierTaxes ?? fare?.taxes ?? 0;
  const markup = money(booking.markupAmount ?? fare?.markup ?? 0);
  const serviceFee = money(booking.serviceFee ?? fare?.serviceFee ?? 0);
  const discount = money(booking.discountAmount ?? fare?.discount ?? 0);
  const total = money(booking.totalAmount);
  const computed = roundMoney(supplierBase + supplierTaxes + markup + serviceFee - discount);

  if (Math.abs(computed - total) > 1) {
    return [{ description: "Airfare", quantity: 1, unitPrice: total, amount: total }];
  }

  const items = [
    { description: "Base fare", quantity: 1, unitPrice: supplierBase, amount: supplierBase },
    { description: "Taxes & surcharges", quantity: 1, unitPrice: supplierTaxes, amount: supplierTaxes },
  ];
  if (markup > 0) items.push({ description: "Markup", quantity: 1, unitPrice: markup, amount: markup });
  if (serviceFee > 0) items.push({ description: "Service fee", quantity: 1, unitPrice: serviceFee, amount: serviceFee });
  if (discount > 0) items.push({ description: "Discount", quantity: 1, unitPrice: -discount, amount: -discount });
  return items.filter((item) => item.amount !== 0);
}

const INVOICE_INCLUDE = {
  items: true,
  booking: { select: { id: true, bookingRef: true, userId: true, organizationId: true } },
  organization: { select: { id: true, name: true } },
} as const;

function viewInvoice(row: Awaited<ReturnType<typeof prisma.invoice.findFirstOrThrow>>) {
  const withRel = row as typeof row & {
    items?: Array<{ id: string; description: string; quantity: number; unitPrice: unknown; amount: unknown }>;
    booking?: { id: string; bookingRef: string; userId: string | null; organizationId: string | null } | null;
    organization?: { id: string; name: string } | null;
  };
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    bookingId: row.bookingId,
    organizationId: row.organizationId,
    amount: money(row.amount),
    tax: money(row.tax),
    total: money(row.total),
    currency: row.currency,
    status: row.status as InvoiceStatus,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    pdfUrl: row.pdfUrl,
    createdAt: row.createdAt.toISOString(),
    bookingRef: withRel.booking?.bookingRef ?? null,
    organizationName: withRel.organization?.name ?? null,
    items: (withRel.items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      amount: money(item.amount),
    })),
  };
}

function pdfPath(invoice: { bookingId: string | null; id: string }) {
  if (invoice.bookingId) return `/api/bookings/${invoice.bookingId}/invoice/pdf`;
  return `/api/invoices/${invoice.id}/pdf`;
}

function paidFromPayments(payments: Array<{ status: string }>) {
  return payments.some((row) => row.status === "SUCCESS");
}

export async function issueBookingInvoice(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true, user: { select: { displayName: true, email: true } } },
  });
  if (!booking) throw new DomainError("BOOKING_NOT_FOUND", "Booking not found.", 404);

  const existing = await prisma.invoice.findFirst({
    where: { bookingId, status: { not: "VOID" } },
    include: INVOICE_INCLUDE,
  });
  const paid = paidFromPayments(booking.payments);
  if (existing) {
    if (paid && existing.status === "ISSUED") {
      const updated = await prisma.invoice.update({
        where: { id: existing.id },
        data: { status: "PAID" },
        include: INVOICE_INCLUDE,
      });
      return viewInvoice(updated);
    }
    return viewInvoice(existing);
  }

  const items = lineItems(booking);
  const { amount, tax, total } = canonicalInvoiceTotals(booking.totalAmount.toString());
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const status: InvoiceStatus = paid ? "PAID" : "ISSUED";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.invoice.create({
        data: {
          bookingId: booking.id,
          organizationId: booking.organizationId,
          invoiceNo: invoiceNo(),
          amount,
          tax,
          total,
          currency: booking.currency,
          status,
          issuedAt,
          dueAt,
          items: { create: items },
        },
        include: INVOICE_INCLUDE,
      });
      const withUrl = await prisma.invoice.update({
        where: { id: created.id },
        data: { pdfUrl: pdfPath(created) },
        include: INVOICE_INCLUDE,
      });
      return viewInvoice(withUrl);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error;
    }
  }
  throw new DomainError("INVOICE_FAILED", "Unable to issue invoice.");
}

export async function listInvoices(filters: { organizationId?: string; take?: number } = {}) {
  const rows = await prisma.invoice.findMany({
    where: {
      ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
      status: { not: "VOID" },
    },
    include: INVOICE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, filters.take ?? 50)),
  });
  return rows.map(viewInvoice);
}

export async function getInvoice(id: string) {
  const row = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  if (!row || row.status === "VOID") throw new DomainError("INVOICE_NOT_FOUND", "Invoice not found.", 404);
  return viewInvoice(row);
}

export async function getInvoiceForBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new DomainError("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (booking.organizationId) {
    const membership = await prisma.organizationUser.findFirst({
      where: { userId, organizationId: booking.organizationId },
    });
    if (!membership) throw new DomainError("FORBIDDEN", "You cannot access this invoice.", 403);
  } else if (booking.userId !== userId) {
    throw new DomainError("FORBIDDEN", "You cannot access this invoice.", 403);
  }
  const row = await prisma.invoice.findFirst({
    where: { bookingId, status: { not: "VOID" } },
    include: INVOICE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  if (!row) throw new DomainError("INVOICE_NOT_FOUND", "Invoice not found.", 404);
  return viewInvoice(row);
}

async function pdfInput(invoiceId: string) {
  const row = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      booking: {
        include: {
          user: { select: { displayName: true, email: true } },
          passengers: true,
          segments: { orderBy: { sequenceNo: "asc" } },
          payments: { orderBy: { createdAt: "desc" }, take: 3 },
          ledger: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      },
      organization: { select: { name: true } },
    },
  });
  if (!row || row.status === "VOID") throw new DomainError("INVOICE_NOT_FOUND", "Invoice not found.", 404);
  const billTo =
    row.organization?.name ||
    row.booking?.user?.displayName ||
    row.booking?.user?.email ||
    "Customer";
  const passengers = (row.booking?.passengers ?? [])
    .map((passenger) => `${passenger.firstName} ${passenger.lastName}`)
    .join(", ");
  const route = routeFromSegments(row.booking?.segments ?? []);
  const payment = row.booking?.payments.find((item) => item.status === "SUCCESS") ?? row.booking?.payments[0];
  const ledger = row.booking?.ledger.find((item) => item.type === "DEBIT") ?? row.booking?.ledger[0];
  let branchName: string | null = null;
  if (row.booking?.userId && row.organizationId) {
    const membership = await prisma.organizationUser.findFirst({
      where: { userId: row.booking.userId, organizationId: row.organizationId },
      include: { branch: true },
    });
    branchName = membership?.branch?.name ?? null;
  }
  return {
    invoice: viewInvoice(row),
    pdf: await buildInvoicePdf({
      invoiceNo: row.invoiceNo,
      status: row.status,
      issuedAt: (row.issuedAt ?? row.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" }),
      dueAt: row.dueAt ? row.dueAt.toLocaleDateString("en-GB", { dateStyle: "medium" }) : null,
      bookingRef: row.booking?.bookingRef ?? null,
      billTo,
      organizationName: row.organization?.name ?? null,
      branchName,
      passengers: passengers || null,
      route,
      paymentReference: payment?.providerRef ?? payment?.id ?? null,
      ledgerReference: ledger?.reference ?? null,
      currency: row.currency,
      amount: money(row.booking?.totalAmount ?? row.amount),
      tax: money(row.tax),
      total: money(row.booking?.totalAmount ?? row.total),
      items: row.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: money(item.unitPrice),
        amount: money(item.amount),
      })),
    }),
  };
}

export async function getInvoicePdf(id: string) {
  const { invoice, pdf } = await pdfInput(id);
  return { bytes: pdf, filename: `ONETRIPS-${invoice.invoiceNo}.pdf`, invoice };
}

export async function getInvoicePdfForBooking(bookingId: string, userId: string) {
  const invoice = await getInvoiceForBooking(bookingId, userId);
  return getInvoicePdf(invoice.id);
}

export async function getInvoicePdfForOrganization(id: string, organizationId: string) {
  const invoice = await getInvoice(id);
  if (invoice.organizationId !== organizationId) {
    throw new DomainError("FORBIDDEN", "You cannot access this invoice.", 403);
  }
  return getInvoicePdf(id);
}

export async function voidBookingInvoices(bookingId: string) {
  await prisma.invoice.updateMany({
    where: { bookingId, status: { in: ["ISSUED", "PAID"] } },
    data: { status: "VOID" },
  });
}
