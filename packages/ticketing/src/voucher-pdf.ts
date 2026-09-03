import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function pdfSafe(value: string) {
  return value.replaceAll("৳", "BDT ").replaceAll("→", "to ").replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "").replace(/\s+/g, " ").trim();
}

const NAVY = rgb(15 / 255, 23 / 255, 42 / 255);
const GOLD = rgb(212 / 255, 175 / 255, 55 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
const INK = rgb(51 / 255, 65 / 255, 85 / 255);

export type HotelVoucherPdfInput = {
  bookingRef: string;
  confirmation: string;
  voucherNumber: string;
  guestName: string;
  guestType: string;
  hotelName: string;
  address: string;
  city: string;
  roomName: string;
  board: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  fareLabel: string;
  issuedAt: string;
};

export async function buildHotelVoucherPdf(input: HotelVoucherPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: NAVY });
  page.drawText("ONE", { x: 40, y: height - 48, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("TRIPS", { x: 92, y: height - 48, size: 22, font: bold, color: GOLD });
  page.drawText("HOTEL VOUCHER", {
    x: width - 200,
    y: height - 46,
    size: 11,
    font: bold,
    color: GOLD,
  });

  let y = height - 140;
  page.drawText(pdfSafe(input.guestName.toUpperCase()), { x: 40, y, size: 18, font: bold, color: NAVY });
  y -= 18;
  page.drawText(pdfSafe(`${input.guestType}  ·  Voucher ${input.voucherNumber}`), {
    x: 40,
    y,
    size: 10,
    font: regular,
    color: MUTED,
  });

  y -= 36;
  const facts = [
    ["Booking", input.bookingRef],
    ["Confirmation", input.confirmation],
    ["Stay", input.fareLabel],
    ["Issued", input.issuedAt],
  ];
  facts.forEach(([label, value], index) => {
    const x = 40 + (index % 2) * 250;
    const rowY = y - Math.floor(index / 2) * 36;
    page.drawText(label.toUpperCase(), { x, y: rowY, size: 8, font: bold, color: GOLD });
    page.drawText(pdfSafe(value), { x, y: rowY - 14, size: 11, font: bold, color: NAVY });
  });

  y -= 100;
  page.drawText("HOTEL", { x: 40, y, size: 9, font: bold, color: GOLD });
  y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: GOLD });
  y -= 28;
  page.drawText(pdfSafe(input.hotelName), { x: 40, y, size: 14, font: bold, color: NAVY });
  y -= 18;
  page.drawText(pdfSafe(`${input.address}, ${input.city}`), { x: 40, y, size: 10, font: regular, color: INK });
  y -= 28;
  page.drawText(pdfSafe(`${input.roomName} · ${input.board}`), { x: 40, y, size: 11, font: bold, color: NAVY });
  y -= 18;
  page.drawText(
    pdfSafe(`Check-in ${input.checkIn}  —  Check-out ${input.checkOut}  ·  ${input.nights} night(s)`),
    { x: 40, y, size: 10, font: regular, color: MUTED },
  );

  page.drawText("Present this voucher at the front desk. ONETRIPS mock vouchers are not valid for a real stay.", {
    x: 40,
    y: 48,
    size: 8,
    font: regular,
    color: MUTED,
  });

  return Buffer.from(await doc.save());
}
