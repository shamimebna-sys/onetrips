import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildInvoicePdf, type InvoicePdfInput } from "./invoice-pdf";

function baseline(overrides: Partial<InvoicePdfInput> = {}): InvoicePdfInput {
  return {
    invoiceNo: "INV-20260830-EBB4",
    status: "PAID",
    issuedAt: "30 Aug 2026",
    dueAt: "6 Sep 2026",
    bookingRef: "OTDF04D6C2",
    billTo: "Shamim Ebna Hasan",
    organizationName: null,
    branchName: null,
    passengers: "Shamim Ebna Hasan",
    route: "DAC to DOH to CXB",
    paymentReference: "pay_ebb4",
    ledgerReference: "LED-ebb4",
    currency: "BDT",
    amount: 3584.5,
    tax: 0,
    total: 3584.5,
    items: [
      { description: "Base fare", quantity: 1, unitPrice: 3000, amount: 3000 },
      { description: "Taxes & surcharges", quantity: 1, unitPrice: 400, amount: 400 },
      { description: "Service fee", quantity: 1, unitPrice: 184.5, amount: 184.5 },
    ],
    ...overrides,
  };
}

function hexToAscii(hex: string) {
  const clean = hex.replace(/\s+/g, "");
  let text = "";
  for (let index = 0; index < clean.length; index += 2) {
    text += String.fromCharCode(Number.parseInt(clean.slice(index, index + 2), 16));
  }
  return text;
}

function collectStreams(doc: PDFDocument, value: unknown): PDFRawStream[] {
  if (value instanceof PDFRef) return collectStreams(doc, doc.context.lookup(value));
  if (value instanceof PDFRawStream) return [value];
  if (value instanceof PDFArray) {
    const streams: PDFRawStream[] = [];
    for (let index = 0; index < value.size(); index += 1) {
      streams.push(...collectStreams(doc, value.get(index)));
    }
    return streams;
  }
  return [];
}

function visibleText(doc: PDFDocument) {
  const chunks: string[] = [];
  for (const page of doc.getPages()) {
    for (const stream of collectStreams(doc, page.node.get(PDFName.of("Contents")))) {
      const decoded = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      for (const match of decoded.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
        chunks.push(hexToAscii(match[1]));
      }
      for (const match of decoded.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
        chunks.push(match[0].slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1"));
      }
    }
  }
  return chunks.join(" ");
}

async function load(input: InvoicePdfInput) {
  const bytes = await buildInvoicePdf(input);
  const doc = await PDFDocument.load(bytes);
  return { bytes, doc, text: visibleText(doc) };
}

function keywords(doc: PDFDocument) {
  const value = doc.getKeywords();
  if (!value) return "";
  return Array.isArray(value) ? value.join(" ") : String(value);
}

describe("buildInvoicePdf", () => {
  it("generates a valid one-page invoice and preserves identity and totals", async () => {
    const { bytes, doc, text } = await load(baseline());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toContain("INV-20260830-EBB4");
    expect(doc.getSubject()).toContain("OTDF04D6C2");
    expect(keywords(doc)).toContain("INV-20260830-EBB4");
    expect(keywords(doc)).toContain("OTDF04D6C2");
    expect(keywords(doc)).toContain("BDT 3,584.50");
    expect(keywords(doc)).toContain("BDT 0.00");
    expect(keywords(doc)).toContain("PAID");
    expect(text).toContain("TAX INVOICE");
    expect(text).toContain("PAID");
    expect(text).toContain("Invoice number");
    expect(text).toContain("INV-20260830-EBB4");
    expect(text).toContain("OTDF04D6C2");
    expect(text).toContain("Shamim Ebna Hasan");
    expect(text).toContain("BILL TO");
    expect(text).toContain("BOOKING");
    expect(text).toContain("DESCRIPTION");
    expect(text).toContain("BDT 3,584.50");
    expect(text).toContain("BDT 0.00");
    expect(text).toContain("Grand total");
    expect(text).toContain("pay_ebb4");
    expect(text).toContain("LED-ebb4");
    expect(text).toContain("ONETRIPS invoice for mock / sandbox bookings. Not a VAT fiscal receipt.");
    expect(text).toContain("Page 1 of 1");
    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
  });

  it("accepts supplied totals without recalculating them", async () => {
    const { doc, text } = await load(
      baseline({
        amount: 79719.4,
        tax: 0,
        total: 79719.4,
        items: [{ description: "Airfare", quantity: 1, unitPrice: 79719.4, amount: 79719.4 }],
      }),
    );
    expect(keywords(doc)).toContain("BDT 79,719.40");
    expect(keywords(doc)).not.toMatch(/BDT 79,719.41/);
    expect(text).toContain("BDT 79,719.40");
    expect(text).not.toContain("BDT 79,719.41");
  });

  it("renders multiple itemized charges including a negative discount line", async () => {
    const { doc, text } = await load(
      baseline({
        items: [
          { description: "Base fare", quantity: 1, unitPrice: 40000, amount: 40000 },
          { description: "Taxes & surcharges", quantity: 1, unitPrice: 6000, amount: 6000 },
          { description: "Markup", quantity: 1, unitPrice: 1500, amount: 1500 },
          { description: "Service fee", quantity: 1, unitPrice: 800, amount: 800 },
          { description: "Discount", quantity: 1, unitPrice: -300, amount: -300 },
        ],
        amount: 48000,
        tax: 0,
        total: 48000,
      }),
    );
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(keywords(doc)).toContain("BDT 48,000.00");
    expect(text).toContain("Discount");
    expect(text).toContain("BDT -300.00");
  });

  it("paginates a long charges table and keeps a valid page count", async () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      description: `Charge line ${index + 1} with an extended professional description`,
      quantity: 1,
      unitPrice: 100 + index,
      amount: 100 + index,
    }));
    const { bytes, doc, text } = await load(baseline({ items }));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(keywords(doc)).toContain("INV-20260830-EBB4");
    expect(keywords(doc)).toContain("BDT 3,584.50");
    expect(text).toContain("Charge line 1");
    expect(text).toContain("Charge line 40");
    expect(text).toContain(`Page ${doc.getPageCount()} of ${doc.getPageCount()}`);
  });

  it("wraps long names, routes, and references", async () => {
    const { doc, text } = await load(
      baseline({
        billTo: "Muhammad Abdullah Al-Mamun Chowdhury Rahman International Holdings Limited",
        organizationName: "North South Corporate Travel Management and Destination Services Organization",
        branchName: "Gulshan Avenue Corporate Advisory Branch",
        passengers: "Alex Rahman, Samira Chowdhury, Mohammed Ibn Abdullah, Fatima Noor",
        route: "DAC to IST to DXB to BKK to SIN to SYD",
        paymentReference: "PAYMENTREFWITHOUTBREAKS0123456789ABCDEFGHIJKLMNOP",
        ledgerReference: "LEDGERREFWITHOUTBREAKS0123456789ABCDEFGHIJKLMNOP",
        bookingRef: "OT-VERYLONGBOOKINGREFERENCE-2026-SEP-0000000001",
      }),
    );
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(keywords(doc)).toContain("OT-VERYLONGBOOKINGREFERENCE-2026-SEP-0000000001");
    expect(text).toContain("Muhammad Abdullah");
    expect(text).toContain("Gulshan Avenue");
  });

  it("renders empty optional values without placeholders", async () => {
    const { doc, text } = await load(
      baseline({
        dueAt: null,
        bookingRef: null,
        organizationName: null,
        branchName: null,
        passengers: null,
        route: null,
        paymentReference: null,
        ledgerReference: null,
        items: [],
        amount: 0,
        tax: 0,
        total: 0,
      }),
    );
    expect(doc.getPageCount()).toBe(1);
    expect(keywords(doc)).toContain("INV-20260830-EBB4");
    expect(keywords(doc)).toContain("BDT 0.00");
    expect(text).toContain("TAX INVOICE");
    expect(text).not.toContain("Due date");
    expect(text).not.toContain("Payment reference");
    expect(text).not.toContain("Ledger reference");
  });

  it("formats large amounts across supported currencies without throwing", async () => {
    for (const currency of ["BDT", "USD", "EUR", "GBP", "AED", "SAR", "INR"]) {
      const { bytes, doc, text } = await load(
        baseline({
          currency,
          amount: 1234567890.99,
          tax: 0,
          total: 1234567890.99,
          items: [{ description: "Airfare", quantity: 1, unitPrice: 1234567890.99, amount: 1234567890.99 }],
        }),
      );
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(keywords(doc)).toContain(`${currency} 1,234,567,890.99`);
      expect(text).toContain(`${currency} 1,234,567,890.99`);
    }
  });

  it("wraps a very long charge description without clipping", async () => {
    const description =
      "International itinerary fare including airport taxes, carrier-imposed surcharges, and a detailed professional description that must wrap across several lines without overlapping adjacent monetary columns";
    const { doc, text } = await load(
      baseline({
        items: [{ description, quantity: 2, unitPrice: 1792.25, amount: 3584.5 }],
      }),
    );
    expect(doc.getPageCount()).toBe(1);
    expect(text).toContain("International itinerary fare");
    expect(text).toContain("BDT 3,584.50");
  });
});
