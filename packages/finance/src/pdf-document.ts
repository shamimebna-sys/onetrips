import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 40;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export const NAVY = rgb(15 / 255, 23 / 255, 42 / 255);
export const GOLD = rgb(212 / 255, 175 / 255, 55 / 255);
export const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
export const INK = rgb(51 / 255, 65 / 255, 85 / 255);
export const WHITE = rgb(1, 1, 1);
export const RULE = rgb(203 / 255, 213 / 255, 225 / 255);
const RULE_SOFT = rgb(226 / 255, 232 / 255, 240 / 255);
const WASH = rgb(248 / 255, 250 / 255, 252 / 255);

const TICKET_HEADER = 40;
const INVOICE_HEADER = 48;
const FOOTER_RESERVE = 34;

export type PdfFonts = { regular: PDFFont; bold: PDFFont };
export type MetaField = { label: string; value: string };
export type DocumentKind = "ticket" | "invoice";

export type JourneySegment = {
  airline: string;
  flightNumber: string;
  origin: string;
  originCity?: string;
  destination: string;
  destinationCity?: string;
  departure: string;
  arrival: string;
  cabin?: string;
  duration?: string;
  baggage?: string;
};

export type TableColumn = {
  header: string;
  width: number;
  align: "left" | "right" | "center";
  emphasis?: boolean;
};

export type PdfFlow = {
  fonts: PdfFonts;
  contentWidth: number;
  ensureSpace(needed: number): void;
  advance(amount: number): void;
  remaining(): number;
  section(title: string): void;
  caption(text: string): void;
  passenger(name: string, type?: string | null): void;
  primaryRef(label: string, value: string): void;
  facts(fields: MetaField[], columns?: number): void;
  inlineFacts(fields: MetaField[]): void;
  journey(segment: JourneySegment, index: number): void;
  connection(airport?: string | null): void;
  note(title: string, body: string): void;
  invoiceNumber(value: string): void;
  invoiceMeta(fields: MetaField[]): void;
  invoiceIdentity(value: string, fields: MetaField[]): void;
  parties(left: { title: string; fields: MetaField[] }, right: { title: string; fields: MetaField[] }): void;
  table(columns: TableColumn[], rows: string[][]): void;
  totals(rows: Array<{ label: string; value: string; emphasize?: boolean }>): void;
  mutedFacts(fields: MetaField[]): void;
  setFooterMeta(parts: string[]): void;
  save(): Promise<Buffer>;
};

type Layout = {
  doc: PDFDocument;
  fonts: PdfFonts;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
  kind: DocumentKind;
  title: string;
  badge: string;
  footerParts: string[];
};

export function pdfSafe(value: string) {
  return value
    .replaceAll("৳", "BDT ")
    .replaceAll("→", " to ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function present(value: string | null | undefined) {
  const safe = pdfSafe(value ?? "");
  return safe || null;
}

export function field(label: string, value: string | null | undefined): MetaField | null {
  const text = present(value);
  return text ? { label, value: text } : null;
}

export function money(currency: string, value: number) {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function textWidth(font: PDFFont, value: string, size: number) {
  return font.widthOfTextAtSize(value, size);
}

export function breakToken(token: string, font: PDFFont, size: number, maxWidth: number) {
  const parts: string[] = [];
  let current = "";
  for (const char of token) {
    const next = current + char;
    if (textWidth(font, next, size) <= maxWidth) current = next;
    else {
      if (current) parts.push(current);
      current = char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = pdfSafe(value);
  if (!safe) return [];
  const words = safe.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const pieces = textWidth(font, word, size) > maxWidth ? breakToken(word, font, size, maxWidth) : [word];
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece;
      if (textWidth(font, next, size) <= maxWidth) current = next;
      else {
        if (current) lines.push(current);
        current = piece;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function splitWhen(value: string) {
  const safe = present(value) ?? "";
  const comma = safe.lastIndexOf(",");
  if (comma > 0) {
    return { date: safe.slice(0, comma).trim(), time: safe.slice(comma + 1).trim() };
  }
  const match = safe.match(/^(.*?)(\d{1,2}:\d{2}(?:\s.*)?)$/);
  if (match?.[1]?.trim() && match[2]) {
    return { date: match[1].trim(), time: match[2].trim() };
  }
  return { date: safe, time: "" };
}

export function fitMoney(value: string, font: PDFFont, maxWidth: number) {
  for (const size of [11, 10, 9, 8, 7]) {
    if (textWidth(font, value, size) <= maxWidth) return { text: value, size };
  }
  return { text: wrapText(value, font, 7, maxWidth)[0] ?? value, size: 7 };
}

export function displayType(value: string | null | undefined) {
  const safe = present(value);
  if (!safe) return null;
  return safe
    .toLowerCase()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function parseBaggage(value: string | null | undefined) {
  const raw = present(value);
  if (!raw) return null;
  const cabin = raw.match(/([^/,]+?)\s*cabin\b/i)?.[1]?.trim() ?? null;
  const checked = raw.match(/([^/,]+?)\s*checked\b/i)?.[1]?.trim() ?? null;
  return { cabin: present(cabin), checked: present(checked), raw };
}

function headerHeight(kind: DocumentKind) {
  return kind === "ticket" ? TICKET_HEADER : INVOICE_HEADER;
}

function contentTop(kind: DocumentKind) {
  return PAGE_HEIGHT - headerHeight(kind) - 14;
}

function contentBottom() {
  return FOOTER_RESERVE + 10;
}

function paint(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  region: "content" | "chrome" = "content",
) {
  const safe = pdfSafe(text);
  if (!safe) return 0;
  const width = textWidth(font, safe, size);
  const minY = region === "chrome" ? 10 : contentBottom() - 1.5;
  if (x < MARGIN - 1.5) throw new Error(`PDF overflow left: ${safe}`);
  if (x + width > PAGE_WIDTH - MARGIN + 1.5) throw new Error(`PDF overflow right: ${safe}`);
  if (y < minY) throw new Error(`PDF overflow bottom: ${safe}`);
  if (y > PAGE_HEIGHT - 6) throw new Error(`PDF overflow top: ${safe}`);
  page.drawText(safe, { x, y, size, font, color });
  return width;
}

function paintRight(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  region: "content" | "chrome" = "content",
) {
  const safe = pdfSafe(text);
  if (!safe) return;
  paint(page, safe, right - textWidth(font, safe, size), y, size, font, color, region);
}

function paintCentered(
  page: PDFPage,
  text: string,
  center: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  region: "content" | "chrome" = "content",
) {
  const safe = pdfSafe(text);
  if (!safe) return;
  paint(page, safe, center - textWidth(font, safe, size) / 2, y, size, font, color, region);
}

function drawWordmark(page: PDFPage, fonts: PdfFonts, x: number, y: number, size: number, onNavy: boolean) {
  paint(page, "ONE", x, y, size, fonts.bold, onNavy ? WHITE : NAVY, "chrome");
  paint(page, "TRIPS", x + textWidth(fonts.bold, "ONE", size) + 1, y, size, fonts.bold, GOLD, "chrome");
}

function drawTicketHeader(page: PDFPage, fonts: PdfFonts, title: string, badge: string) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - TICKET_HEADER, width: PAGE_WIDTH, height: TICKET_HEADER, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - TICKET_HEADER - 2.5, width: PAGE_WIDTH, height: 2.5, color: GOLD });
  drawWordmark(page, fonts, MARGIN, PAGE_HEIGHT - 26, 13, true);
  const titleText = pdfSafe(title);
  paintRight(page, titleText, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 18, 9, fonts.bold, WHITE, "chrome");
  const status = present(badge);
  if (status) {
    paintRight(page, status.toUpperCase(), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 31, 7.5, fonts.bold, GOLD, "chrome");
  }
}

function drawInvoiceHeader(page: PDFPage, fonts: PdfFonts, title: string, badge: string) {
  drawWordmark(page, fonts, MARGIN, PAGE_HEIGHT - 30, 15, false);
  const titleText = pdfSafe(title);
  paintRight(page, titleText, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 22, 12, fonts.bold, NAVY, "chrome");
  const status = present(badge);
  if (status) {
    const label = status.toUpperCase();
    const width = textWidth(fonts.bold, label, 7) + 14;
    page.drawRectangle({
      x: PAGE_WIDTH - MARGIN - width,
      y: PAGE_HEIGHT - 42,
      width,
      height: 13,
      color: NAVY,
    });
    paint(page, label, PAGE_WIDTH - MARGIN - width + 7, PAGE_HEIGHT - 38.5, 7, fonts.bold, WHITE, "chrome");
  }
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - INVOICE_HEADER },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - INVOICE_HEADER },
    thickness: 1.4,
    color: GOLD,
  });
}

function drawHeader(layout: Layout) {
  if (layout.kind === "ticket") drawTicketHeader(layout.page, layout.fonts, layout.title, layout.badge);
  else drawInvoiceHeader(layout.page, layout.fonts, layout.title, layout.badge);
}

function drawFooter(page: PDFPage, fonts: PdfFonts, parts: string[], pageNo: number, pageCount: number) {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_RESERVE },
    end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_RESERVE },
    thickness: 0.7,
    color: RULE,
  });
  const left = wrapText(["ONETRIPS", ...parts.map((part) => present(part) ?? "").filter(Boolean)].join("   "), fonts.regular, 7, CONTENT_WIDTH - 88);
  if (left[0]) paint(page, left[0], MARGIN, 20, 7, fonts.regular, MUTED, "chrome");
  paintRight(page, `Page ${pageNo} of ${pageCount}`, PAGE_WIDTH - MARGIN, 20, 7, fonts.regular, MUTED, "chrome");
}

function addPage(layout: Layout) {
  layout.page = layout.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  layout.pages.push(layout.page);
  drawHeader(layout);
  layout.y = contentTop(layout.kind);
}

function ensureSpace(layout: Layout, needed: number) {
  if (layout.y - needed < contentBottom()) addPage(layout);
}

function advance(layout: Layout, amount: number) {
  layout.y -= amount;
}

function drawSection(layout: Layout, title: string) {
  ensureSpace(layout, 24);
  paint(layout.page, pdfSafe(title).toUpperCase(), MARGIN, layout.y, 8, layout.fonts.bold, NAVY);
  advance(layout, 7);
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y },
    end: { x: MARGIN + 22, y: layout.y },
    thickness: 1.6,
    color: GOLD,
  });
  layout.page.drawLine({
    start: { x: MARGIN + 24, y: layout.y },
    end: { x: PAGE_WIDTH - MARGIN, y: layout.y },
    thickness: 0.5,
    color: RULE,
  });
  advance(layout, 12);
}

function drawCaption(layout: Layout, text: string) {
  const lines = wrapText(text, layout.fonts.bold, 8, CONTENT_WIDTH);
  if (lines.length === 0) return;
  ensureSpace(layout, 12 + lines.length * 11);
  lines.forEach((line) => {
    paint(layout.page, line, MARGIN, layout.y, 8, layout.fonts.bold, NAVY);
    advance(layout, 11);
  });
  advance(layout, 6);
}

function headingSize(font: PDFFont, value: string, maxWidth: number, sizes: number[]) {
  for (const size of sizes) {
    if (textWidth(font, value, size) <= maxWidth) return size;
  }
  return sizes[sizes.length - 1] ?? 11;
}

function drawPassenger(layout: Layout, name: string, type?: string | null) {
  const display = present(name);
  if (!display) return;
  const heading = display.toUpperCase();
  const typeLabel = displayType(type);
  const nameLines = wrapText(heading, layout.fonts.bold, headingSize(layout.fonts.bold, heading, CONTENT_WIDTH, [17, 15, 13, 11]), CONTENT_WIDTH);
  const size = headingSize(layout.fonts.bold, nameLines[0] ?? heading, CONTENT_WIDTH, [17, 15, 13, 11]);
  const lines = wrapText(heading, layout.fonts.bold, size, CONTENT_WIDTH);
  const height = 6 + lines.length * (size + 3) + (typeLabel ? 12 : 0);
  ensureSpace(layout, height + 8);
  lines.forEach((line, index) => {
    paint(layout.page, line, MARGIN, layout.y - index * (size + 3), size, layout.fonts.bold, NAVY);
  });
  advance(layout, lines.length * (size + 3));
  if (typeLabel) {
    paint(layout.page, typeLabel, MARGIN, layout.y, 9, layout.fonts.regular, MUTED);
    advance(layout, 12);
  } else {
    advance(layout, 6);
  }
}

function drawPrimaryRef(layout: Layout, label: string, value: string) {
  const display = present(value);
  if (!display) return;
  const size = headingSize(layout.fonts.bold, display, CONTENT_WIDTH, [13, 12, 11, 10]);
  const lines = wrapText(display, layout.fonts.bold, size, CONTENT_WIDTH);
  ensureSpace(layout, 16 + lines.length * (size + 2));
  paint(layout.page, label, MARGIN, layout.y, 6.5, layout.fonts.regular, MUTED);
  advance(layout, 11);
  lines.forEach((line) => {
    paint(layout.page, line, MARGIN, layout.y, size, layout.fonts.bold, NAVY);
    advance(layout, size + 2);
  });
  advance(layout, 8);
}

function drawInlineFacts(layout: Layout, fields: MetaField[]) {
  if (fields.length === 0) return;
  const parts = fields.map((item) => ({
    label: item.label,
    value: item.value,
    width: textWidth(layout.fonts.regular, item.label, 6.5) + 6 + textWidth(layout.fonts.bold, item.value, 8.5),
  }));
  const lines: typeof parts[] = [];
  let current: typeof parts = [];
  let used = 0;
  for (const part of parts) {
    const next = used === 0 ? part.width : used + 18 + part.width;
    if (current.length && next > CONTENT_WIDTH) {
      lines.push(current);
      current = [part];
      used = part.width;
    } else {
      current.push(part);
      used = next;
    }
  }
  if (current.length) lines.push(current);
  ensureSpace(layout, 8 + lines.length * 16 + 6);
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: layout.y + 4 },
    thickness: 0.6,
    color: RULE,
  });
  advance(layout, 10);
  for (const row of lines) {
    let x = MARGIN;
    row.forEach((part, index) => {
      if (index > 0) x += 16;
      paint(layout.page, part.label, x, layout.y, 6.5, layout.fonts.regular, MUTED);
      x += textWidth(layout.fonts.regular, part.label, 6.5) + 5;
      const valueLines = wrapText(part.value, layout.fonts.bold, 8.5, PAGE_WIDTH - MARGIN - x);
      paint(layout.page, valueLines[0] ?? part.value, x, layout.y, 8.5, layout.fonts.bold, NAVY);
      x += textWidth(layout.fonts.bold, valueLines[0] ?? part.value, 8.5);
    });
    advance(layout, 16);
  }
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y + 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: layout.y + 2 },
    thickness: 0.6,
    color: RULE,
  });
  advance(layout, 12);
}

function measureFact(fonts: PdfFonts, item: MetaField, width: number) {
  return 10 + wrapText(item.value, fonts.bold, 9, width).length * 11;
}

function drawFacts(layout: Layout, fields: MetaField[], columns: number) {
  if (fields.length === 0) return;
  const cols = Math.max(1, columns);
  const gap = 16;
  const width = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
  const rows = Math.ceil(fields.length / cols);
  const rowHeights = Array.from({ length: rows }, (_, row) => {
    const slice = fields.slice(row * cols, row * cols + cols);
    return slice.reduce((max, item) => Math.max(max, measureFact(layout.fonts, item, width)), 20);
  });
  const band = 12 + rowHeights.reduce((sum, height) => sum + height, 0);
  ensureSpace(layout, band + 8);
  const top = layout.y;
  layout.page.drawLine({
    start: { x: MARGIN, y: top + 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: top + 6 },
    thickness: 0.6,
    color: RULE,
  });
  let cursor = top - 6;
  for (let row = 0; row < rows; row += 1) {
    const slice = fields.slice(row * cols, row * cols + cols);
    slice.forEach((item, col) => {
      const x = MARGIN + col * (width + gap);
      paint(layout.page, item.label, x, cursor, 6.5, layout.fonts.regular, MUTED);
      wrapText(item.value, layout.fonts.bold, 9, width).forEach((line, index) => {
        paint(layout.page, line, x, cursor - 11 - index * 11, 9, layout.fonts.bold, NAVY);
      });
    });
    cursor -= rowHeights[row] ?? 20;
  }
  layout.page.drawLine({
    start: { x: MARGIN, y: cursor + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: cursor + 4 },
    thickness: 0.6,
    color: RULE,
  });
  layout.y = cursor - 10;
}

function drawInvoiceNumber(layout: Layout, value: string) {
  const number = present(value);
  if (!number) return;
  const size = headingSize(layout.fonts.bold, number, CONTENT_WIDTH, [16, 14, 12, 11]);
  const lines = wrapText(number, layout.fonts.bold, size, CONTENT_WIDTH);
  ensureSpace(layout, 18 + lines.length * (size + 3));
  paint(layout.page, "Invoice number", MARGIN, layout.y, 7, layout.fonts.regular, MUTED);
  advance(layout, 12);
  lines.forEach((line) => {
    paint(layout.page, line, MARGIN, layout.y, size, layout.fonts.bold, NAVY);
    advance(layout, size + 3);
  });
  advance(layout, 8);
}

function drawInvoiceMeta(layout: Layout, fields: MetaField[]) {
  drawFacts(layout, fields, Math.min(fields.length, 3) || 1);
}

function drawInvoiceIdentity(layout: Layout, value: string, fields: MetaField[]) {
  const number = present(value);
  if (!number && fields.length === 0) return;
  const leftWidth = CONTENT_WIDTH * 0.5;
  const rightWidth = CONTENT_WIDTH - leftWidth - 18;
  const size = number ? headingSize(layout.fonts.bold, number, leftWidth, [16, 14, 12, 11]) : 11;
  const numberLines = number ? wrapText(number, layout.fonts.bold, size, leftWidth) : [];
  const cols = Math.min(Math.max(fields.length, 1), 3);
  const metaWidth = (rightWidth - 10 * (cols - 1)) / cols;
  const metaHeight = fields.reduce((max, item) => Math.max(max, measureFact(layout.fonts, item, metaWidth)), 20);
  const height = Math.max(16 + numberLines.length * (size + 3), metaHeight);
  ensureSpace(layout, height + 10);
  const top = layout.y;
  if (number) {
    paint(layout.page, "Invoice number", MARGIN, top, 7, layout.fonts.regular, MUTED);
    numberLines.forEach((line, index) => {
      paint(layout.page, line, MARGIN, top - 13 - index * (size + 3), size, layout.fonts.bold, NAVY);
    });
  }
  fields.forEach((item, index) => {
    const x = MARGIN + leftWidth + 18 + index * (metaWidth + 10);
    paint(layout.page, item.label, x, top, 6.5, layout.fonts.regular, MUTED);
    wrapText(item.value, layout.fonts.bold, 9, metaWidth).forEach((line, lineIndex) => {
      paint(layout.page, line, x, top - 12 - lineIndex * 11, 9, layout.fonts.bold, NAVY);
    });
  });
  layout.y = top - height - 6;
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: layout.y + 4 },
    thickness: 0.6,
    color: RULE,
  });
  advance(layout, 12);
}

function measureStack(fonts: PdfFonts, fields: MetaField[], width: number) {
  return fields.reduce((sum, item) => {
    const size = item.label ? 9 : 11;
    return sum + (item.label ? 11 : 0) + wrapText(item.value, fonts.bold, size, width).length * (size + 2) + 6;
  }, 12);
}

function drawStack(layout: Layout, title: string, fields: MetaField[], x: number, top: number, width: number) {
  paint(layout.page, title.toUpperCase(), x, top, 7, layout.fonts.bold, MUTED);
  let y = top - 14;
  for (const item of fields) {
    if (item.label) {
      paint(layout.page, item.label, x, y, 6.5, layout.fonts.regular, MUTED);
      y -= 11;
    }
    const size = item.label ? 9 : 11;
    wrapText(item.value, layout.fonts.bold, size, width).forEach((line) => {
      paint(layout.page, line, x, y, size, layout.fonts.bold, NAVY);
      y -= size + 2;
    });
    y -= 6;
  }
}

function drawParties(
  layout: Layout,
  left: { title: string; fields: MetaField[] },
  right: { title: string; fields: MetaField[] },
) {
  const gap = 28;
  const width = (CONTENT_WIDTH - gap) / 2;
  const height = Math.max(
    left.fields.length ? measureStack(layout.fonts, left.fields, width) : 0,
    right.fields.length ? measureStack(layout.fonts, right.fields, width) : 0,
    16,
  );
  ensureSpace(layout, height + 10);
  const top = layout.y;
  if (left.fields.length) drawStack(layout, left.title, left.fields, MARGIN, top, width);
  if (right.fields.length) {
    layout.page.drawLine({
      start: { x: MARGIN + width + gap / 2, y: top + 4 },
      end: { x: MARGIN + width + gap / 2, y: top - height + 8 },
      thickness: 0.5,
      color: RULE_SOFT,
    });
    drawStack(layout, right.title, right.fields, MARGIN + width + gap, top, width);
  }
  layout.y = top - height - 4;
}

function drawMutedFacts(layout: Layout, fields: MetaField[]) {
  if (fields.length === 0) return;
  const gap = 20;
  const width = (CONTENT_WIDTH - gap * (fields.length - 1)) / Math.max(fields.length, 1);
  const height = fields.reduce((max, item) => Math.max(max, 10 + wrapText(item.value, layout.fonts.regular, 8, width).length * 10), 18);
  ensureSpace(layout, height + 6);
  const top = layout.y;
  fields.forEach((item, index) => {
    const x = MARGIN + index * (width + gap);
    paint(layout.page, item.label, x, top, 6.5, layout.fonts.regular, MUTED);
    wrapText(item.value, layout.fonts.regular, 8, width).forEach((line, lineIndex) => {
      paint(layout.page, line, x, top - 11 - lineIndex * 10, 8, layout.fonts.regular, INK);
    });
  });
  layout.y = top - height - 8;
}

function measureEndpoint(fonts: PdfFonts, code: string, city: string | null, when: { date: string; time: string }, width: number) {
  const cityLines = city ? wrapText(city, fonts.regular, 8, width).length : 0;
  const dateLines = when.date ? wrapText(when.date, fonts.regular, 8, width).length : 0;
  const timeLines = when.time ? wrapText(when.time, fonts.bold, 13, width).length : 0;
  return 16 + cityLines * 10 + dateLines * 10 + timeLines * 16 + 11;
}

function drawEndpoint(
  page: PDFPage,
  fonts: PdfFonts,
  code: string,
  city: string | null,
  when: { date: string; time: string },
  label: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right",
) {
  const codeText = (present(code) ?? "").toUpperCase();
  if (codeText) {
    const codeX = align === "left" ? x : x + width - textWidth(fonts.bold, codeText, 15);
    paint(page, codeText, codeX, y, 15, fonts.bold, NAVY);
  }
  let cursor = y - 14;
  if (city) {
    wrapText(city, fonts.regular, 8, width).forEach((line) => {
      const lineX = align === "left" ? x : x + width - textWidth(fonts.regular, line, 8);
      paint(page, line, lineX, cursor, 8, fonts.regular, MUTED);
      cursor -= 10;
    });
  }
  if (when.date) {
    wrapText(when.date, fonts.regular, 8, width).forEach((line) => {
      const lineX = align === "left" ? x : x + width - textWidth(fonts.regular, line, 8);
      paint(page, line, lineX, cursor, 8, fonts.regular, INK);
      cursor -= 10;
    });
  }
  if (when.time) {
    wrapText(when.time, fonts.bold, 13, width).forEach((line) => {
      const lineX = align === "left" ? x : x + width - textWidth(fonts.bold, line, 13);
      paint(page, line, lineX, cursor, 13, fonts.bold, NAVY);
      cursor -= 16;
    });
  }
  paint(page, label, align === "left" ? x : x + width - textWidth(fonts.regular, label, 7), cursor, 7, fonts.regular, MUTED);
  cursor -= 11;
  return y - cursor;
}

function baggageRows(segment: JourneySegment) {
  const parsed = parseBaggage(segment.baggage);
  if (!parsed) return [];
  const rows: MetaField[] = [];
  if (parsed.cabin) rows.push({ label: "Cabin", value: parsed.cabin });
  if (parsed.checked) rows.push({ label: "Checked", value: parsed.checked });
  if (rows.length === 0) rows.push({ label: "Baggage", value: parsed.raw });
  return rows;
}

function measureJourney(fonts: PdfFonts, segment: JourneySegment) {
  const gutter = 88;
  const colWidth = (CONTENT_WIDTH - gutter) / 2;
  const originH = measureEndpoint(fonts, segment.origin, present(segment.originCity), splitWhen(segment.departure), colWidth);
  const destH = measureEndpoint(fonts, segment.destination, present(segment.destinationCity), splitWhen(segment.arrival), colWidth);
  const airline = [present(segment.airline), present(segment.flightNumber)].filter(Boolean).join("  ");
  const airlineLines = airline ? wrapText(airline, fonts.bold, 9, CONTENT_WIDTH * 0.55).length : 1;
  const cabin = present(segment.cabin);
  const duration = present(segment.duration);
  const meta = cabin || duration ? 18 : 0;
  const bags = baggageRows(segment);
  const bagHeight = bags.length ? 16 + Math.ceil(bags.length / 2) * 16 : 0;
  return 20 + airlineLines * 12 + 10 + Math.max(originH, destH, 54) + meta + bagHeight + 12;
}

function drawMetaPair(layout: Layout, fields: MetaField[], y: number) {
  if (fields.length === 0) return y;
  const width = (CONTENT_WIDTH - 20) / 2;
  fields.forEach((item, index) => {
    const x = MARGIN + (index % 2) * (width + 20);
    const rowY = y - Math.floor(index / 2) * 16;
    paint(layout.page, item.label, x, rowY, 7, layout.fonts.regular, MUTED);
    const labelW = textWidth(layout.fonts.regular, item.label, 7) + 8;
    wrapText(item.value, layout.fonts.bold, 8.5, width - labelW).forEach((line, lineIndex) => {
      paint(layout.page, line, x + labelW, rowY - lineIndex * 11, 8.5, layout.fonts.bold, NAVY);
    });
  });
  return y - Math.ceil(fields.length / 2) * 16;
}

function drawJourney(layout: Layout, segment: JourneySegment, index: number) {
  const height = measureJourney(layout.fonts, segment);
  ensureSpace(layout, height + 6);
  const top = layout.y;
  const flightLabel = `FLIGHT ${String(index).padStart(2, "0")}`;
  paint(layout.page, flightLabel, MARGIN, top, 7.5, layout.fonts.bold, MUTED);
  const airline = [present(segment.airline), present(segment.flightNumber)].filter(Boolean).join("  ").toUpperCase();
  let headerBottom = top - 4;
  if (airline) {
    const lines = wrapText(airline, layout.fonts.bold, 9, CONTENT_WIDTH * 0.58);
    lines.forEach((line, lineIndex) => {
      paintRight(layout.page, line, PAGE_WIDTH - MARGIN, top - lineIndex * 11, 9, layout.fonts.bold, NAVY);
    });
    headerBottom = top - (lines.length - 1) * 11 - 4;
  }
  layout.page.drawLine({
    start: { x: MARGIN, y: headerBottom - 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: headerBottom - 6 },
    thickness: 0.7,
    color: NAVY,
  });
  layout.page.drawLine({
    start: { x: MARGIN, y: headerBottom - 8.4 },
    end: { x: MARGIN + 36, y: headerBottom - 8.4 },
    thickness: 1.6,
    color: GOLD,
  });

  const gutter = 88;
  const colWidth = (CONTENT_WIDTH - gutter) / 2;
  const blockY = headerBottom - 22;
  drawEndpoint(
    layout.page,
    layout.fonts,
    segment.origin,
    present(segment.originCity),
    splitWhen(segment.departure),
    "Departure",
    MARGIN,
    blockY,
    colWidth,
    "left",
  );
  const midX = MARGIN + colWidth + gutter / 2;
  const pathY = blockY - 28;
  layout.page.drawLine({
    start: { x: midX - 28, y: pathY },
    end: { x: midX - 5, y: pathY },
    thickness: 1,
    color: GOLD,
  });
  layout.page.drawCircle({ x: midX, y: pathY, size: 2.4, color: NAVY });
  layout.page.drawLine({
    start: { x: midX + 5, y: pathY },
    end: { x: midX + 28, y: pathY },
    thickness: 1,
    color: GOLD,
  });
  drawEndpoint(
    layout.page,
    layout.fonts,
    segment.destination,
    present(segment.destinationCity),
    splitWhen(segment.arrival),
    "Arrival",
    MARGIN + colWidth + gutter,
    blockY,
    colWidth,
    "right",
  );

  let y =
    blockY -
    Math.max(
      measureEndpoint(layout.fonts, segment.origin, present(segment.originCity), splitWhen(segment.departure), colWidth),
      measureEndpoint(layout.fonts, segment.destination, present(segment.destinationCity), splitWhen(segment.arrival), colWidth),
      54,
    ) -
    4;
  const meta: MetaField[] = [];
  const cabin = present(segment.cabin);
  const duration = present(segment.duration);
  if (cabin) meta.push({ label: "Class", value: cabin });
  if (duration) meta.push({ label: "Duration", value: duration });
  if (meta.length) y = drawMetaPair(layout, meta, y) - 4;
  const bags = baggageRows(segment);
  if (bags.length) {
    paint(layout.page, "Baggage", MARGIN, y, 7, layout.fonts.bold, MUTED);
    y -= 13;
    y = drawMetaPair(layout, bags, y);
  }
  layout.y = top - height;
}

function drawConnection(layout: Layout, airport?: string | null) {
  const code = present(airport)?.toUpperCase() ?? null;
  const shown = code && textWidth(layout.fonts.bold, code, 9) > 80 ? wrapText(code, layout.fonts.bold, 9, 80)[0] ?? code : code;
  const height = shown ? 38 : 30;
  ensureSpace(layout, height + 4);
  const top = layout.y;
  const railX = MARGIN + 6;
  layout.page.drawLine({
    start: { x: railX, y: top + 2 },
    end: { x: railX, y: top - height + 6 },
    thickness: 1.4,
    color: NAVY,
  });
  layout.page.drawCircle({ x: railX, y: top - 14, size: 3.2, color: GOLD });
  paint(layout.page, "CONNECTION", railX + 14, top - 10, 7, layout.fonts.bold, NAVY);
  if (shown) paint(layout.page, shown, railX + 14, top - 22, 9, layout.fonts.bold, NAVY);
  layout.y = top - height;
}

function drawNote(layout: Layout, title: string, body: string) {
  const lines = wrapText(body, layout.fonts.regular, 8.5, CONTENT_WIDTH);
  ensureSpace(layout, 28);
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: layout.y + 4 },
    thickness: 0.45,
    color: RULE_SOFT,
  });
  paint(layout.page, title, MARGIN, layout.y - 8, 8, layout.fonts.bold, NAVY);
  advance(layout, 20);
  for (const line of lines) {
    ensureSpace(layout, 12);
    paint(layout.page, line, MARGIN, layout.y, 8.5, layout.fonts.regular, INK);
    advance(layout, 12);
  }
  advance(layout, 8);
}

function drawTableHeader(layout: Layout, columns: TableColumn[]) {
  ensureSpace(layout, 22);
  layout.page.drawRectangle({
    x: MARGIN,
    y: layout.y - 7,
    width: CONTENT_WIDTH,
    height: 20,
    color: NAVY,
  });
  let x = MARGIN;
  for (const column of columns) {
    const inset = 6;
    if (column.align === "right") {
      paintRight(layout.page, column.header, x + column.width - inset, layout.y, 7, layout.fonts.bold, WHITE);
    } else if (column.align === "center") {
      paintCentered(layout.page, column.header, x + column.width / 2, layout.y, 7, layout.fonts.bold, WHITE);
    } else {
      paint(layout.page, column.header, x + inset, layout.y, 7, layout.fonts.bold, WHITE);
    }
    x += column.width;
  }
  advance(layout, 20);
}

function drawTableRow(layout: Layout, columns: TableColumn[], cells: string[], stripe: boolean) {
  const wrapped = columns.map((column, index) => wrapText(cells[index] ?? "", layout.fonts.regular, 9, column.width - 12));
  const lines = Math.max(1, ...wrapped.map((item) => item.length));
  const height = Math.max(20, lines * 12) + 6;
  if (layout.y - height < contentBottom()) {
    addPage(layout);
    drawTableHeader(layout, columns);
  }
  if (stripe) {
    layout.page.drawRectangle({
      x: MARGIN,
      y: layout.y - height + 12,
      width: CONTENT_WIDTH,
      height,
      color: WASH,
    });
  }
  let x = MARGIN;
  columns.forEach((column, index) => {
    const font = column.emphasis ? layout.fonts.bold : layout.fonts.regular;
    const color = column.emphasis ? NAVY : INK;
    wrapped[index]?.forEach((line, lineIndex) => {
      const y = layout.y - lineIndex * 12;
      if (column.align === "right") paintRight(layout.page, line, x + column.width - 6, y, 9, font, color);
      else if (column.align === "center") paintCentered(layout.page, line, x + column.width / 2, y, 9, font, color);
      else paint(layout.page, line, x + 6, y, 9, font, color);
    });
    x += column.width;
  });
  advance(layout, height);
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y + 10 },
    end: { x: PAGE_WIDTH - MARGIN, y: layout.y + 10 },
    thickness: 0.4,
    color: RULE_SOFT,
  });
}

function drawTable(layout: Layout, columns: TableColumn[], rows: string[][]) {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  if (Math.abs(total - CONTENT_WIDTH) > 1) {
    throw new Error(`PDF table columns must fill the content width (${total} vs ${CONTENT_WIDTH})`);
  }
  drawTableHeader(layout, columns);
  if (rows.length === 0) {
    ensureSpace(layout, 18);
    advance(layout, 12);
    return;
  }
  rows.forEach((row, index) => drawTableRow(layout, columns, row, index % 2 === 1));
}

function drawTotals(layout: Layout, rows: Array<{ label: string; value: string; emphasize?: boolean }>) {
  const block = 16 + rows.reduce((sum, row) => sum + (row.emphasize ? 28 : 16), 0);
  ensureSpace(layout, block);
  advance(layout, 10);
  const width = 236;
  const left = PAGE_WIDTH - MARGIN - width;
  for (const row of rows) {
    if (row.emphasize) {
      ensureSpace(layout, 30);
      advance(layout, 6);
      layout.page.drawRectangle({
        x: left,
        y: layout.y - 10,
        width,
        height: 24,
        color: NAVY,
      });
      paint(layout.page, row.label, left + 10, layout.y - 2, 10, layout.fonts.bold, WHITE);
      const display = fitMoney(row.value, layout.fonts.bold, width - 110);
      paintRight(layout.page, display.text, PAGE_WIDTH - MARGIN - 10, layout.y - 2, Math.max(display.size, 11), layout.fonts.bold, WHITE);
      advance(layout, 22);
    } else {
      ensureSpace(layout, 16);
      paint(layout.page, row.label, left + 10, layout.y, 8.5, layout.fonts.regular, MUTED);
      const display = fitMoney(row.value, layout.fonts.bold, width - 110);
      paintRight(layout.page, display.text, PAGE_WIDTH - MARGIN - 10, layout.y, display.size, layout.fonts.bold, NAVY);
      advance(layout, 16);
    }
  }
}

export async function openDocument(options: {
  kind: DocumentKind;
  title: string;
  badge?: string;
  docTitle: string;
  subject?: string;
  keywords?: string[];
}): Promise<PdfFlow> {
  const doc = await PDFDocument.create();
  const fonts: PdfFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  doc.setTitle(pdfSafe(options.docTitle));
  doc.setAuthor("ONETRIPS");
  doc.setSubject(pdfSafe(options.subject ?? options.title));
  doc.setCreator("ONETRIPS");
  doc.setProducer("ONETRIPS");
  doc.setKeywords((options.keywords ?? []).map((value) => pdfSafe(value)).filter(Boolean));

  const layout: Layout = {
    doc,
    fonts,
    pages: [],
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: contentTop(options.kind),
    kind: options.kind,
    title: options.title,
    badge: options.badge ?? "",
    footerParts: [],
  };
  layout.pages.push(layout.page);
  drawHeader(layout);

  return {
    fonts,
    contentWidth: CONTENT_WIDTH,
    ensureSpace: (needed) => ensureSpace(layout, needed),
    advance: (amount) => advance(layout, amount),
    remaining: () => layout.y - contentBottom(),
    section: (title) => drawSection(layout, title),
    caption: (text) => drawCaption(layout, text),
    passenger: (name, type) => drawPassenger(layout, name, type),
    primaryRef: (label, value) => drawPrimaryRef(layout, label, value),
    facts: (fields, columns = 3) => drawFacts(layout, fields, columns),
    inlineFacts: (fields) => drawInlineFacts(layout, fields),
    journey: (segment, index) => drawJourney(layout, segment, index),
    connection: (airport) => drawConnection(layout, airport),
    note: (title, body) => drawNote(layout, title, body),
    invoiceNumber: (value) => drawInvoiceNumber(layout, value),
    invoiceMeta: (fields) => drawInvoiceMeta(layout, fields),
    invoiceIdentity: (value, fields) => drawInvoiceIdentity(layout, value, fields),
    parties: (left, right) => drawParties(layout, left, right),
    table: (columns, rows) => drawTable(layout, columns, rows),
    totals: (rows) => drawTotals(layout, rows),
    mutedFacts: (fields) => drawMutedFacts(layout, fields),
    setFooterMeta: (parts) => {
      layout.footerParts = parts;
    },
    save: async () => {
      layout.pages.forEach((page, index) => {
        drawFooter(page, fonts, layout.footerParts, index + 1, layout.pages.length);
      });
      return Buffer.from(await doc.save());
    },
  };
}
