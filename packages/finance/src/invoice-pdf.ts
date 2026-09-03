import { CONTENT_WIDTH, field, money, openDocument, present, type MetaField } from "./pdf-document";

export type InvoicePdfInput = {
  invoiceNo: string;
  status: string;
  issuedAt: string;
  dueAt: string | null;
  bookingRef: string | null;
  billTo: string;
  organizationName?: string | null;
  branchName?: string | null;
  passengers?: string | null;
  route?: string | null;
  paymentReference?: string | null;
  ledgerReference?: string | null;
  currency: string;
  amount: number;
  tax: number;
  total: number;
  items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
};

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const invoiceNo = present(input.invoiceNo) ?? "";
  const bookingRef = present(input.bookingRef);
  const flow = await openDocument({
    kind: "invoice",
    title: "TAX INVOICE",
    badge: input.status,
    docTitle: `ONETRIPS Tax Invoice ${invoiceNo}`.trim(),
    subject: bookingRef ? `Booking ${bookingRef}` : "Tax Invoice",
    keywords: [
      input.invoiceNo,
      input.bookingRef ?? "",
      input.currency,
      money(input.currency, input.amount),
      money(input.currency, input.tax),
      money(input.currency, input.total),
      input.status,
      input.issuedAt,
    ],
  });

  flow.invoiceIdentity(
    input.invoiceNo,
    [
      field("Issue date", input.issuedAt),
      field("Due date", input.dueAt),
      field("Currency", input.currency),
    ].filter((item): item is MetaField => item !== null),
  );

  const organization =
    present(input.organizationName) && present(input.organizationName) !== present(input.billTo)
      ? input.organizationName
      : null;
  const customerName = present(input.billTo);
  const billTo = [
    customerName ? { label: "", value: customerName } : null,
    field("Organization", organization),
    field("Branch", input.branchName),
  ].filter((item): item is MetaField => item !== null);
  const booking = [
    field("Booking reference", input.bookingRef),
    field("Passenger(s)", input.passengers),
    field("Route", input.route),
  ].filter((item): item is MetaField => item !== null);
  flow.parties({ title: "Bill to", fields: billTo }, { title: "Booking", fields: booking });

  flow.section("Charges");
  const descriptionWidth = 248;
  const qtyWidth = 42;
  const unitWidth = 110;
  const amountWidth = CONTENT_WIDTH - descriptionWidth - qtyWidth - unitWidth;
  flow.table(
    [
      { header: "DESCRIPTION", width: descriptionWidth, align: "left" },
      { header: "QTY", width: qtyWidth, align: "center" },
      { header: "UNIT AMOUNT", width: unitWidth, align: "right" },
      { header: "AMOUNT", width: amountWidth, align: "right", emphasis: true },
    ],
    input.items.map((item) => [
      item.description,
      String(item.quantity),
      money(input.currency, item.unitPrice),
      money(input.currency, item.amount),
    ]),
  );

  flow.totals([
    { label: "Subtotal", value: money(input.currency, input.amount) },
    { label: "Tax", value: money(input.currency, input.tax) },
    { label: "Grand total", value: money(input.currency, input.total), emphasize: true },
  ]);

  flow.advance(8);
  flow.mutedFacts(
    [
      field("Payment reference", input.paymentReference),
      field("Ledger reference", input.ledgerReference),
    ].filter((item): item is MetaField => item !== null),
  );

  flow.note("Important", "ONETRIPS invoice for mock / sandbox bookings. Not a VAT fiscal receipt.");

  flow.setFooterMeta(invoiceNo ? [`Invoice ${invoiceNo}`] : []);
  return flow.save();
}

export { money };
