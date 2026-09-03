import {
  CONTENT_WIDTH,
  concatTicketChapters,
  displayMoney,
  field,
  money,
  openDocument,
  present,
  type JourneySegment,
  type MetaField,
  type PdfFlow,
} from "./pdf-document";

export type TicketPdfSegment = JourneySegment;

export type TicketPdfPenalty = {
  type: string;
  amountLabel?: string | null;
  notes?: string | null;
};

export type TicketPdfFareLine = {
  label: string;
  amount: string;
};

export type TicketPdfInput = {
  bookingRef: string;
  pnr: string;
  ticketNumber: string;
  ticketStatus: string;
  passengerName: string;
  passengerType: string;
  fareLabel: string;
  issuedAt: string;
  itineraries: Array<{ segments: TicketPdfSegment[] }>;
  cabin?: string | null;
  fareRuleSummary?: string | null;
  changeInfo?: string | null;
  refundable?: boolean | null;
  changeable?: boolean | null;
  brandedFare?: string | null;
  penalties?: TicketPdfPenalty[] | null;
  fareLines?: TicketPdfFareLine[] | null;
};

const CHECK_IN_NOTICE = "Present this e-ticket and your passport at check-in.";
const MOCK_TICKET_NOTICE = "ONETRIPS mock tickets are not valid for travel.";

const SUPPORT_EMAIL = "support@onetrips.com";
const SUPPORT_HOURS = "Sunday-Thursday, 9:00-18:00 BST";
const SUPPORT_INTRO = "Need help with a booking, payment, or ticket? Email our team or open Account Support for an existing booking.";

const TERMS = [
  "By creating an account or completing a booking on ONETRIPS you agree to these terms. Bookings are contracts between you and ONETRIPS for the arrangement of travel services supplied by airlines, hotels, and payment providers.",
  "Fares and rooms are subject to availability and revalidation. Prices can change until you confirm payment. You are responsible for traveler names, passport details, and travel documents matching the booking.",
  "These terms do not replace airline conditions of carriage or hotel policies, which also apply to your trip.",
];

const CANCELLATION_POLICY = [
  "You may cancel a booking from the booking page when the current status allows it. Unpaid holds are cancelled immediately. After payment, cancellation follows supplier rules and may incur fees.",
  "Issued tickets may need to be voided before a refund can start. Failed supplier bookings are cancelled without a ticket.",
];

const REFUND_POLICY = [
  "Refunds follow the fare or room rules of the supplier and the booking state on ONETRIPS. Non-refundable fares and rooms may not be refundable after ticketing.",
  "If payment is captured and the booking later fails or is cancelled where the rules allow, we initiate a refund through the original payment method or wallet. Partial refunds leave the remainder open until settled.",
  "Refund status is shown on the booking page. Processing times depend on the payment provider.",
];

function yesNo(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return null;
}

function isMockFareCopy(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return false;
  return /^mock fare rules\b/i.test(text) || /\bmock (change|cancellation) fee\b/i.test(text);
}

function fareValue(value: string | null | undefined) {
  return displayMoney(value);
}

function ticketMeta(input: TicketPdfInput) {
  const ticketNumber = present(input.ticketNumber) ?? "";
  const bookingRef = present(input.bookingRef) ?? "";
  return {
    ticketNumber,
    bookingRef,
    docTitle: `ONETRIPS Electronic Ticket ${ticketNumber}`.trim(),
    subject: `Booking ${bookingRef}`.trim(),
    keywords: [
      input.ticketNumber,
      input.bookingRef,
      input.pnr,
      input.fareLabel,
      input.passengerName,
      input.issuedAt,
      input.ticketStatus,
    ],
    footerParts: [ticketNumber && `Ticket ${ticketNumber}`, bookingRef && `Booking ${bookingRef}`].filter(Boolean),
  };
}

async function openTicket(input: TicketPdfInput) {
  const meta = ticketMeta(input);
  return openDocument({
    kind: "ticket",
    title: "ELECTRONIC TICKET",
    badge: input.ticketStatus,
    docTitle: meta.docTitle,
    subject: meta.subject,
    keywords: meta.keywords,
  });
}

function journeyGroups(input: TicketPdfInput) {
  return input.itineraries.filter((group) => group.segments.length > 0);
}

function drawPassengerBlock(flow: PdfFlow, input: TicketPdfInput) {
  flow.section("Passenger information");
  flow.passenger(input.passengerName, input.passengerType);
  flow.primaryRef("Ticket number", input.ticketNumber);
  flow.inlineFacts(
    [
      field("Booking reference", input.bookingRef),
      field("PNR", input.pnr),
      field("Issue date / time", input.issuedAt),
      field("Cabin", input.cabin),
      field("Fare", fareValue(input.fareLabel)),
    ].filter((item): item is NonNullable<typeof item> => item !== null),
  );
}

function drawItinerary(flow: PdfFlow, groups: Array<{ segments: TicketPdfSegment[] }>) {
  flow.section("Itinerary");
  if (groups.length === 0) {
    flow.advance(4);
    return;
  }
  let segmentNo = 0;
  groups.forEach((group, groupIndex) => {
    if (groups.length > 1) {
      flow.caption(`Journey ${groupIndex + 1} of ${groups.length}`);
    }
    group.segments.forEach((segment, segmentIndex) => {
      segmentNo += 1;
      if (segmentIndex > 0) {
        const via = present(group.segments[segmentIndex - 1]?.destination) ?? present(segment.origin);
        flow.ensureSpace(flow.measureConnection(via) + flow.measureJourney(segment) + 10);
        flow.connection(via);
      }
      flow.journey(segment, segmentNo);
    });
  });
}

function drawFareRulesChapter(
  flow: PdfFlow,
  fareFlags: MetaField[],
  fareRules: string | null,
  penalties: TicketPdfPenalty[],
  changeInfo: string | null,
) {
  flow.section("Fare rules");
  if (fareFlags.length) {
    const labelWidth = 180;
    flow.table(
      [
        { header: "CONDITION", width: labelWidth, align: "left" },
        { header: "DETAIL", width: CONTENT_WIDTH - labelWidth, align: "left" },
      ],
      fareFlags.map((row) => [row.label, row.value]),
    );
  }
  if (fareRules) flow.note("Important conditions", fareRules);

  if (penalties.length) {
    flow.section("Change / cancellation");
    const typeWidth = 110;
    const amountWidth = 130;
    const notesWidth = CONTENT_WIDTH - typeWidth - amountWidth;
    flow.table(
      [
        { header: "TYPE", width: typeWidth, align: "left" },
        { header: "AMOUNT", width: amountWidth, align: "right" },
        { header: "NOTES", width: notesWidth, align: "left" },
      ],
      penalties.map((row) => [row.type, row.amountLabel ?? "", row.notes ?? ""]),
    );
  } else if (changeInfo) {
    flow.section("Change / cancellation");
    flow.note("Existing ticket conditions", changeInfo);
  }
}

function drawFareSummaryChapter(flow: PdfFlow, input: TicketPdfInput, fareLines: TicketPdfFareLine[]) {
  flow.section("Fare summary");
  flow.inlineFacts(
    [
      field("Booking reference", input.bookingRef),
      field("Ticket number", input.ticketNumber),
      field("Fare", fareValue(input.fareLabel)),
    ].filter((item): item is NonNullable<typeof item> => item !== null),
  );
  const totalLine = fareLines.find((row) => row.label.toLowerCase() === "total");
  const detailLines = fareLines.filter((row) => row.label.toLowerCase() !== "total");
  if (detailLines.length) {
    const labelWidth = CONTENT_WIDTH - 160;
    flow.table(
      [
        { header: "DESCRIPTION", width: labelWidth, align: "left" },
        { header: "AMOUNT", width: 160, align: "right", emphasis: true },
      ],
      detailLines.map((row) => [row.label, fareValue(row.amount) ?? row.amount]),
    );
  }
  const totalValue = fareValue(totalLine?.amount);
  if (totalValue) {
    flow.totals([{ label: "Total", value: totalValue, emphasize: true }]);
  }
}

function drawSupportingChapter(flow: PdfFlow, includePolicies: boolean) {
  flow.section("Contact / support");
  flow.facts(
    [
      field("Email", SUPPORT_EMAIL),
      field("Hours", SUPPORT_HOURS),
    ].filter((item): item is MetaField => item !== null),
    2,
  );
  flow.note("Support", SUPPORT_INTRO);
  flow.section("Travel information");
  flow.note("Check-in", CHECK_IN_NOTICE);
  flow.section("Terms and conditions");
  flow.note("ONETRIPS terms", TERMS.join(" "));
  if (includePolicies) {
    flow.section("ONETRIPS General Policy");
    flow.note("Cancellation", CANCELLATION_POLICY.join(" "));
    flow.note("Refund", REFUND_POLICY.join(" "));
  }
  flow.section("Important");
  flow.note("Important", MOCK_TICKET_NOTICE);
}

export async function buildTicketPdf(input: TicketPdfInput): Promise<Buffer> {
  const groups = journeyGroups(input);
  const fareRules = present(input.fareRuleSummary) && !isMockFareCopy(input.fareRuleSummary) ? present(input.fareRuleSummary) : null;
  const penalties = (input.penalties ?? []).filter(
    (row) => !isMockFareCopy(row.notes) && (present(row.type) || present(row.amountLabel) || present(row.notes)),
  );
  const changeInfo = present(input.changeInfo) && !isMockFareCopy(input.changeInfo) ? present(input.changeInfo) : null;
  const fareLines = (input.fareLines ?? []).flatMap((row) => {
    const amount = fareValue(row.amount);
    const label = present(row.label);
    return label && amount ? [{ label, amount }] : [];
  });
  const fareFlags = [
    field("Refundability", yesNo(input.refundable)),
    field("Changeable", yesNo(input.changeable)),
    field("Branded fare", input.brandedFare),
  ].filter((item): item is MetaField => item !== null);
  const hasConditions = Boolean(fareRules || changeInfo || penalties.length || fareFlags.length);
  const hasFareBreakdown = fareLines.length > 0;
  const hasJourney = groups.length > 0;
  const splitChapters = hasJourney || hasConditions || hasFareBreakdown;
  const meta = ticketMeta(input);

  const chapters: Buffer[] = [];

  const itinerary = await openTicket(input);
  drawPassengerBlock(itinerary, input);
  drawItinerary(itinerary, groups);
  if (!splitChapters) drawSupportingChapter(itinerary, true);
  chapters.push(await itinerary.saveWithoutFooter());

  if (hasConditions) {
    const fare = await openTicket(input);
    drawFareRulesChapter(fare, fareFlags, fareRules, penalties, changeInfo);
    chapters.push(await fare.saveWithoutFooter());
  }

  if (hasFareBreakdown) {
    const summary = await openTicket(input);
    drawFareSummaryChapter(summary, input, fareLines);
    chapters.push(await summary.saveWithoutFooter());
  }

  if (splitChapters) {
    const supporting = await openTicket(input);
    drawSupportingChapter(supporting, true);
    chapters.push(await supporting.saveWithoutFooter());
  }

  if (hasJourney && chapters.length < 2) {
    throw new Error("Ticket PDF itinerary chapter must not include later document sections");
  }

  return concatTicketChapters(chapters, meta.footerParts, {
    title: meta.docTitle,
    subject: meta.subject,
    keywords: meta.keywords,
  });
}

export { money };
