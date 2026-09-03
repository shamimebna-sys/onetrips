import { mkdirSync, writeFileSync } from "node:fs";
import { buildTicketPdf, type TicketPdfInput } from "../packages/ticketing/src/pdf.ts";

const out = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });

const segment = {
  airline: "Air Astra",
  flightNumber: "2A470",
  origin: "DAC",
  originCity: "Dhaka",
  destination: "DOH",
  destinationCity: "Doha",
  departure: "2 Sep 2026, 16:20",
  arrival: "2 Sep 2026, 16:50",
  cabin: "Economy",
  duration: "0h 30m",
  baggage: "7 kg cabin / 20 kg checked",
};

const sample: TicketPdfInput = {
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
        segment,
        {
          ...segment,
          flightNumber: "2A471",
          origin: "DOH",
          originCity: "Doha",
          destination: "CXB",
          destinationCity: "Cox's Bazar",
          departure: "2 Sep 2026, 19:10",
          arrival: "2 Sep 2026, 23:40",
          duration: "4h 30m",
        },
      ],
    },
  ],
  fareRuleSummary: "Mock fare rules. Change and refund permitted before departure with a fee.",
  refundable: true,
  changeable: true,
  brandedFare: "Flex",
  penalties: [
    { type: "CHANGE", amountLabel: "BDT 2,500.00", notes: "Mock change fee" },
    { type: "REFUND", amountLabel: "BDT 2,500.00", notes: "Mock cancellation fee" },
  ],
};

const variants: Array<[string, TicketPdfInput]> = [
  ["ticket-sample.pdf", sample],
  [
    "ticket-with-fare-summary.pdf",
    {
      ...sample,
      fareLines: [
        { label: "Base fare", amount: "BDT 2,800.00" },
        { label: "Taxes & surcharges", amount: "BDT 784.50" },
        { label: "Total", amount: "BDT 3,584.50" },
      ],
    },
  ],
  ["ticket-one-flight.pdf", { ...sample, itineraries: [{ segments: [segment] }] }],
  [
    "ticket-long-rules.pdf",
    {
      ...sample,
      fareRuleSummary: Array.from({ length: 80 }, (_, index) => `Existing fare rule line ${index + 1} from the offer snapshot.`).join(" "),
    },
  ],
  [
    "ticket-itinerary-only.pdf",
    {
      ...sample,
      fareRuleSummary: null,
      refundable: null,
      changeable: null,
      brandedFare: null,
      penalties: [],
      fareLines: [],
    },
  ],
];

for (const [name, input] of variants) {
  const bytes = await buildTicketPdf(input);
  writeFileSync(new URL(name, import.meta.url), bytes);
  console.log(name, bytes.length);
}
