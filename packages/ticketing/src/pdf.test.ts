import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildTicketPdf, type TicketPdfInput, type TicketPdfSegment } from "./pdf";

function segment(overrides: Partial<TicketPdfSegment> = {}): TicketPdfSegment {
  return {
    airline: "Air Astra",
    flightNumber: "2A470",
    origin: "DAC",
    originCity: "Dhaka",
    destination: "DOH",
    destinationCity: "Doha",
    departure: "2 Sep 2026, 16:20",
    arrival: "2 Sep 2026, 16:50",
    ...overrides,
  };
}

function sampleOfferSupport(overrides: Partial<TicketPdfInput> = {}): Partial<TicketPdfInput> {
  return {
    fareRuleSummary: "Change and refund permitted before departure with a fee.",
    refundable: true,
    changeable: true,
    brandedFare: "Flex",
    penalties: [
      { type: "CHANGE", amountLabel: "BDT 2,500.00", notes: "Change fee before departure" },
      { type: "REFUND", amountLabel: "BDT 2,500.00", notes: "Cancellation fee before departure" },
    ],
    ...overrides,
  };
}

function baseline(overrides: Partial<TicketPdfInput> = {}): TicketPdfInput {
  return {
    bookingRef: "OTDF04D6C2",
    pnr: "MCKIH6G8Z",
    ticketNumber: "1472728317816",
    ticketStatus: "ISSUED",
    passengerName: "Shamim Ebna Hasan",
    passengerType: "ADULT",
    fareLabel: "BDT 3,584.50",
    issuedAt: "30 Aug 2026, 16:12",
    itineraries: [
      {
        segments: [
          segment({ cabin: "Economy", duration: "0h 30m", baggage: "7 kg cabin / 20 kg checked" }),
          segment({
            airline: "Air Astra",
            flightNumber: "2A471",
            origin: "DOH",
            originCity: "Doha",
            destination: "CXB",
            destinationCity: "Cox's Bazar",
            departure: "2 Sep 2026, 19:10",
            arrival: "2 Sep 2026, 23:40",
            cabin: "Economy",
            duration: "4h 30m",
            baggage: "7 kg cabin / 20 kg checked",
          }),
        ],
      },
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

function pageText(doc: PDFDocument, pageIndex: number) {
  const chunks: string[] = [];
  const page = doc.getPages()[pageIndex];
  if (!page) return "";
  for (const stream of collectStreams(doc, page.node.get(PDFName.of("Contents")))) {
    const decoded = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    for (const match of decoded.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
      chunks.push(hexToAscii(match[1]));
    }
    for (const match of decoded.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      chunks.push(match[0].slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1"));
    }
  }
  return chunks.join(" ");
}

function visibleText(doc: PDFDocument) {
  return doc.getPages().map((_, index) => pageText(doc, index)).join(" ");
}

async function load(input: TicketPdfInput) {
  const bytes = await buildTicketPdf(input);
  const doc = await PDFDocument.load(bytes);
  return { bytes, doc, text: visibleText(doc) };
}

function keywords(doc: PDFDocument) {
  const value = doc.getKeywords();
  if (!value) return "";
  return Array.isArray(value) ? value.join(" ") : String(value);
}

describe("buildTicketPdf", () => {
  it("generates a multi-page A4 ticket and preserves identity values", async () => {
    const { bytes, doc, text } = await load(baseline(sampleOfferSupport()));
    const pages = doc.getPageCount();
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pages).toBeGreaterThan(1);
    expect(doc.getTitle()).toContain("1472728317816");
    expect(doc.getSubject()).toContain("OTDF04D6C2");
    expect(keywords(doc)).toContain("1472728317816");
    expect(keywords(doc)).toContain("OTDF04D6C2");
    expect(keywords(doc)).toContain("MCKIH6G8Z");
    expect(keywords(doc)).toContain("BDT 3,584.50");
    expect(keywords(doc)).toContain("ISSUED");
    expect(text).toContain("ELECTRONIC TICKET");
    expect(text).toContain("SHAMIM EBNA HASAN");
    expect(text).toContain("Adult");
    expect(text).toContain("1472728317816");
    expect(text).toContain("OTDF04D6C2");
    expect(text).toContain("MCKIH6G8Z");
    expect(text).toContain("BDT 3,584.50");
    expect(text).toContain("CONNECTION");
    expect(text).toContain("ONETRIPS mock tickets are not valid for travel.");
    expect(text).toContain("Ticket 1472728317816");
    expect(text).toContain("Booking OTDF04D6C2");
    expect(text).toContain(`Page 1 of ${pages}`);
    expect(text).toContain(`Page ${pages} of ${pages}`);
    expect(text).not.toContain("Page 1 of 1");
    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
    const first = pageText(doc, 0);
    const rest = Array.from({ length: pages - 1 }, (_, index) => pageText(doc, index + 1)).join(" ");
    expect(first).toContain("ITINERARY");
    expect(first).toContain("DAC");
    expect(first).toContain("CXB");
    expect(first).not.toContain("FARE RULES");
    expect(first).not.toContain("FARE SUMMARY");
    expect(first).not.toContain("TERMS AND CONDITIONS");
    expect(rest).toContain("FARE RULES");
    expect(rest).toContain("TRAVEL INFORMATION");
    expect(rest).toContain("CONTACT / SUPPORT");
    expect(pages).toBeGreaterThanOrEqual(3);
  });

  it("renders a multi-segment connecting itinerary on the journey page", async () => {
    const { doc, text } = await load(baseline());
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain("DAC");
    expect(text).toContain("DOH");
    expect(text).toContain("CXB");
    expect(text).toContain("2A470");
    expect(text).toContain("2A471");
    expect(text).toContain("Economy");
    expect(text).toContain("0h 30m");
    expect(text).toContain("Baggage");
    expect(text).toContain("Cabin");
    expect(text).toContain("Checked");
    expect(text).toContain("7 kg");
    expect(text).toContain("20 kg");
    expect(text).not.toMatch(/Economy 0h 30m 7 kg cabin \/ 20 kg checked/);
    expect(pageText(doc, 0)).toContain("FLIGHT 01");
    expect(pageText(doc, 0)).toContain("FLIGHT 02");
  });

  it("paginates a single-flight ticket instead of compressing notices onto page 1", async () => {
    const { doc, text } = await load(
      baseline({
        itineraries: [{ segments: [segment({ cabin: "Economy", duration: "0h 30m", baggage: "7 kg cabin / 20 kg checked" })] }],
      }),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(pageText(doc, 0)).toContain("DAC");
    expect(pageText(doc, 0)).not.toContain("TRAVEL INFORMATION");
    expect(text).toContain("Present this e-ticket and your passport at check-in.");
    expect(text).toContain(`Page 1 of ${doc.getPageCount()}`);
  });

  it("paginates many connecting segments", async () => {
    const segments = Array.from({ length: 18 }, (_, index) =>
      segment({
        flightNumber: `2A${470 + index}`,
        origin: index % 2 === 0 ? "DAC" : "DOH",
        destination: index % 2 === 0 ? "DOH" : "CXB",
      }),
    );
    const { bytes, doc, text } = await load(baseline({ itineraries: [{ segments }] }));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(keywords(doc)).toContain("1472728317816");
    expect(text).toContain("Page 1 of ");
    expect(text).toMatch(/Page \d+ of \d+/);
    expect(text).toContain(`Page ${doc.getPageCount()} of ${doc.getPageCount()}`);
  });

  it("keeps grouped itineraries without throwing", async () => {
    const { doc, text } = await load(
      baseline({
        itineraries: [
          { segments: [segment(), segment({ origin: "DOH", destination: "CXB", originCity: "Doha", destinationCity: "Cox's Bazar" })] },
          { segments: [segment({ origin: "CXB", destination: "DAC", originCity: "Cox's Bazar", destinationCity: "Dhaka" })] },
        ],
      }),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain("Journey 1 of 2");
    expect(text).toContain("Journey 2 of 2");
  });

  it("wraps long passenger names and references without overflowing", async () => {
    const { bytes, doc, text } = await load(
      baseline({
        passengerName: "Muhammad Abdullah Al-Mamun Chowdhury Rahman International Traveler Extraordinaire",
        bookingRef: "OT-VERYLONGBOOKINGREFERENCE-2026-SEP-0000000001",
        pnr: "PNRWITHOUTSPACESABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        ticketNumber: "125-9999999999999999999999999999",
        fareLabel: "USD 1,234,567,890.99",
      }),
    );
    expect(bytes.length).toBeGreaterThan(1000);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(keywords(doc)).toContain("125-9999999999999999999999999999");
    expect(keywords(doc)).toContain("OT-VERYLONGBOOKINGREFERENCE-2026-SEP-0000000001");
    expect(text).toContain("MUHAMMAD ABDULLAH");
    expect(text).toContain("USD 1,234,567,890.99");
  });

  it("renders empty optional cities and empty itineraries", async () => {
    const { doc, text } = await load(
      baseline({
        ticketStatus: "",
        issuedAt: "",
        itineraries: [],
      }),
    );
    expect(doc.getPageCount()).toBe(1);
    expect(text).toContain("ELECTRONIC TICKET");
    expect(text).not.toContain("STATUS:");
    expect(text).not.toContain("ISSUED");
  });

  it("omits cabin, duration, and baggage when the domain does not provide them", async () => {
    const { text } = await load(
      baseline({
        itineraries: [{ segments: [segment(), segment({ origin: "DOH", destination: "CXB", originCity: "Doha", destinationCity: "Cox's Bazar" })] }],
      }),
    );
    expect(text).not.toContain("Class");
    expect(text).not.toContain("Duration");
    expect(text).not.toContain("Baggage");
    expect(text).not.toContain("Cabin");
    expect(text).not.toContain("Checked");
  });

  it("renders complete BDT fare and total amounts instead of a currency-only Taka label", async () => {
    const { bytes, doc, text } = await load(
      baseline(
        sampleOfferSupport({
          fareLabel: "৳ 3,584.50",
          fareLines: [
            { label: "Base fare", amount: "BDT 2,800.00" },
            { label: "Taxes & surcharges", amount: "BDT 784.50" },
            { label: "Total", amount: "৳ 3,584.50" },
          ],
        }),
      ),
    );
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(text).toContain("FARE SUMMARY");
    expect(text).toContain("Base fare");
    expect(text).toContain("BDT 2,800.00");
    expect(text).toContain("BDT 3,584.50");
    expect(text).toContain("Total");
    expect(pageText(doc, 0)).not.toContain("FARE SUMMARY");
  });

  it("omits mock fare-rule placeholders instead of presenting them as airline rules", async () => {
    const { text } = await load(
      baseline({
        fareRuleSummary: "Mock fare rules. This fare is non-refundable.",
        changeInfo: "CHANGE · BDT 2500 · Mock change fee",
        penalties: [{ type: "CHANGE", amountLabel: "BDT 2,500.00", notes: "Mock change fee" }],
      }),
    );
    expect(text).not.toContain("Mock fare rules");
    expect(text).not.toContain("Mock change fee");
    expect(text).not.toContain("BDT 2,500.00");
    expect(text).toContain("ONETRIPS GENERAL POLICY");
  });

  it("does not throw for supported fare labels", async () => {
    for (const fareLabel of ["BDT 100.00", "USD 100.00", "EUR 100.00", "GBP 100.00", "AED 100.00", "SAR 100.00", "INR 100.00"]) {
      const { bytes, doc, text } = await load(baseline({ fareLabel }));
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(keywords(doc)).toContain(fareLabel);
      expect(text).toContain(fareLabel);
    }
  });

  it("includes existing fare rules and paginates long supporting copy", async () => {
    const fareRuleSummary = Array.from({ length: 120 }, (_, index) => `Existing fare rule line ${index + 1} from the offer snapshot.`).join(" ");
    const { doc, text } = await load(
      baseline({
        fareRuleSummary,
        changeInfo: "CHANGE · BDT 2500 · Change fee before departure",
      }),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain("FARE RULES");
    expect(text).toContain("CHANGE / CANCELLATION");
    expect(text).toContain("Existing fare rule line 1 from the offer snapshot.");
    expect(text).toContain("Existing fare rule line 120 from the offer snapshot.");
    expect(text).toContain("Change fee before departure");
    expect(text).toContain("ONETRIPS GENERAL POLICY");
    expect(text).toContain(`Page ${doc.getPageCount()} of ${doc.getPageCount()}`);
    expect(pageText(doc, 0)).not.toContain("Existing fare rule line 1");
  });

  it("renders structured penalties and existing fare lines without inventing rows", async () => {
    const { doc, text } = await load(
      baseline(
        sampleOfferSupport({
          fareLines: [
            { label: "Base fare", amount: "BDT 2,800.00" },
            { label: "Taxes & surcharges", amount: "BDT 784.50" },
            { label: "Total", amount: "BDT 3,584.50" },
          ],
        }),
      ),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain("Flex");
    expect(text).toContain("Yes");
    expect(text).toContain("CHANGE");
    expect(text).toContain("REFUND");
    expect(text).toContain("BDT 2,500.00");
    expect(text).toContain("Cancellation fee before departure");
    expect(text).toContain("ONETRIPS GENERAL POLICY");
    expect(text).toContain("FARE SUMMARY");
    expect(text).toContain("Base fare");
    expect(text).toContain("Taxes & surcharges");
    expect(pageText(doc, 0)).not.toContain("FARE SUMMARY");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
    const pages = Array.from({ length: doc.getPageCount() }, (_, index) => pageText(doc, index));
    expect(pages.some((page) => page.includes("FARE RULES") && !page.includes("FARE SUMMARY"))).toBe(true);
    expect(pages.some((page) => page.includes("FARE SUMMARY") && !page.includes("FLIGHT 01"))).toBe(true);
    expect(text).toContain("TERMS AND CONDITIONS");
    expect(pageText(doc, 0)).not.toContain("TERMS AND CONDITIONS");
  });

  it("renders aircraft when the offer snapshot provides it", async () => {
    const { text } = await load(
      baseline({
        itineraries: [
          {
            segments: [
              segment({ cabin: "Economy", duration: "0h 30m", baggage: "7 kg cabin / 20 kg checked", aircraft: "ATR 72" }),
            ],
          },
        ],
      }),
    );
    expect(text).toContain("Aircraft");
    expect(text).toContain("ATR 72");
  });

  it("omits supporting sections when the domain does not provide them", async () => {
    const { doc, text } = await load(baseline({ fareRuleSummary: null, changeInfo: null, penalties: [], fareLines: [] }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(text).not.toContain("FARE RULES");
    expect(text).not.toContain("CHANGE / CANCELLATION");
    expect(text).not.toContain("FARE SUMMARY");
    expect(text).toContain("Present this e-ticket and your passport at check-in.");
    expect(pageText(doc, 0)).not.toContain("TRAVEL INFORMATION");
  });
});
