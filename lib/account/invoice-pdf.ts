import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Server-side invoice PDF generation.
//
// Produces a clean, single-page (auto-paginating) letter-size invoice sheet
// with all line items, totals, contact info, notes, and payment status.
// Mirrors the on-screen print layout but renders to a real downloadable /
// attachable PDF via pdf-lib (no headless browser needed).
// ---------------------------------------------------------------------------

export interface InvoicePdfLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
}

export interface InvoicePdfContact {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate?: Date | null;
  reference?: string | null;
  notes?: string | null;
  subTotal: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  contact?: InvoicePdfContact | null;
  lineItems: InvoicePdfLineItem[];
  stripePaymentLinkUrl?: string | null;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const CYAN = rgb(0.031, 0.569, 0.698); // #0891b2
const INK = rgb(0.067, 0.067, 0.067); // #111
const GREY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.6, 0.6, 0.6);
const RULE = rgb(0.9, 0.9, 0.92);
const GREEN = rgb(0.02, 0.588, 0.412);

const PAGE_W = 612; // 8.5in
const PAGE_H = 792; // 11in
const MARGIN = 54; // 0.75in
const CONTENT_W = PAGE_W - MARGIN * 2;

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Helvetica (WinAnsi) can't encode many unicode chars (em-dash, smart quotes,
 * etc.) and pdf-lib throws on them. Normalize the common ones, drop the rest.
 */
function safe(s: string): string {
  return (s ?? '')
    .replace(/[—–]/g, '-') // em/en dash
    .replace(/[‘’‛]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/…/g, '...') // ellipsis
    .replace(/ /g, ' ') // nbsp
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, ''); // strip anything else WinAnsi can't render
}

/** Wrap a string to a max width in points for the given font/size. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function buildInvoicePdf(inv: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${inv.invoiceNumber}`);
  pdf.setAuthor('Your KC Homes LLC');
  pdf.setSubject(`Invoice ${inv.invoiceNumber}`);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const color = opts.color ?? INK;
    const str = safe(s);
    let drawX = x;
    if (opts.align === 'right') drawX = x - f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: drawX, y: yy, size, font: f, color });
  };

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN + 40) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // ---- Header -----------------------------------------------------------
  text('Your KC Homes LLC', MARGIN, y, { size: 18, font: bold });
  text('INVOICE', PAGE_W - MARGIN, y + 2, { size: 22, font: bold, color: CYAN, align: 'right' });
  y -= 18;
  text('Independence, MO', MARGIN, y, { size: 10, color: GREY });
  text(inv.invoiceNumber, PAGE_W - MARGIN, y, { size: 12, font: bold, align: 'right' });
  y -= 14;
  text('tolley.io', MARGIN, y, { size: 10, color: GREY });
  text(`Status: ${inv.status}`, PAGE_W - MARGIN, y, { size: 9, color: GREY, align: 'right' });
  y -= 34;

  // ---- Bill To + Dates --------------------------------------------------
  const colRightX = PAGE_W - MARGIN;
  const topY = y;
  text('BILL TO', MARGIN, y, { size: 8, color: LIGHT });
  let leftY = y - 14;
  if (inv.contact) {
    text(inv.contact.name, MARGIN, leftY, { size: 11, font: bold });
    leftY -= 13;
    const lines: string[] = [];
    if (inv.contact.email) lines.push(inv.contact.email);
    if (inv.contact.phone) lines.push(inv.contact.phone);
    if (inv.contact.address) {
      const cityState = [inv.contact.city, inv.contact.state].filter(Boolean).join(', ');
      const tail = [cityState, inv.contact.zip].filter(Boolean).join(' ');
      lines.push(tail ? `${inv.contact.address}, ${tail}` : inv.contact.address);
    }
    for (const l of lines) {
      text(l, MARGIN, leftY, { size: 9.5, color: GREY });
      leftY -= 12;
    }
  } else {
    text('—', MARGIN, leftY, { size: 11, color: LIGHT });
    leftY -= 13;
  }

  // Dates (right column)
  let rightY = topY;
  text('ISSUE DATE', colRightX, rightY, { size: 8, color: LIGHT, align: 'right' });
  rightY -= 13;
  text(fmtDate(inv.issueDate), colRightX, rightY, { size: 10.5, font: bold, align: 'right' });
  rightY -= 18;
  if (inv.dueDate) {
    text('DUE DATE', colRightX, rightY, { size: 8, color: LIGHT, align: 'right' });
    rightY -= 13;
    text(fmtDate(inv.dueDate), colRightX, rightY, { size: 10.5, font: bold, align: 'right' });
    rightY -= 18;
  }
  if (inv.reference) {
    text('REFERENCE', colRightX, rightY, { size: 8, color: LIGHT, align: 'right' });
    rightY -= 13;
    text(inv.reference, colRightX, rightY, { size: 10, align: 'right' });
    rightY -= 18;
  }

  y = Math.min(leftY, rightY) - 12;

  // ---- Line item table --------------------------------------------------
  // Columns: Description (left) | Qty | Unit Price | Amount — numeric columns
  // are ALL right-aligned to their right edge so digits line up and never
  // collide with neighbouring columns regardless of magnitude.
  const xDesc = MARGIN; // 54  — description left edge
  const xAmountR = PAGE_W - MARGIN; // 558 — Amount column right edge
  const xUnitR = xAmountR - 112; // 446 — Unit Price column right edge
  const xQtyR = xUnitR - 66; // 380 — Qty column right edge
  const descMaxW = xQtyR - 48 - xDesc; // wrap width, keeps a gap before Qty

  const drawTableHeader = () => {
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: PAGE_W - MARGIN, y: y + 6 },
      thickness: 1.5,
      color: INK,
    });
    text('DESCRIPTION', xDesc, y - 6, { size: 8, color: LIGHT });
    text('QTY', xQtyR, y - 6, { size: 8, color: LIGHT, align: 'right' });
    text('UNIT PRICE', xUnitR, y - 6, { size: 8, color: LIGHT, align: 'right' });
    text('AMOUNT', xAmountR, y - 6, { size: 8, color: LIGHT, align: 'right' });
    y -= 20;
  };

  drawTableHeader();

  for (const li of inv.lineItems) {
    const descLines = wrap(li.description || '', font, 10, descMaxW);
    const rowHeight = Math.max(descLines.length * 12, 14) + 8;
    newPageIfNeeded(rowHeight);
    if (y === PAGE_H - MARGIN) drawTableHeader(); // fresh page got a header

    const rowTop = y;
    descLines.forEach((dl, i) => {
      text(dl, xDesc, rowTop - i * 12, { size: 10 });
    });
    text(String(li.quantity), xQtyR, rowTop, { size: 10, color: GREY, align: 'right' });
    text(fmt.format(li.unitAmount), xUnitR, rowTop, { size: 10, color: GREY, align: 'right' });
    text(fmt.format(li.lineAmount), xAmountR, rowTop, { size: 10, align: 'right' });

    y = rowTop - rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: PAGE_W - MARGIN, y: y + 6 },
      thickness: 0.5,
      color: RULE,
    });
  }

  // ---- Totals -----------------------------------------------------------
  // Right-aligned 230pt block: labels sit at the left edge, values right-align
  // to the page margin — same "space-between" look as the on-screen print view.
  newPageIfNeeded(80);
  y -= 12;
  const totalsLeftX = PAGE_W - MARGIN - 230; // 328 — label left edge
  const totalsValueX = xAmountR; // 558 — value right edge

  text('Subtotal', totalsLeftX, y, { size: 10, color: GREY });
  text(fmt.format(inv.subTotal), totalsValueX, y, { size: 10, align: 'right' });
  y -= 16;

  if (inv.amountPaid > 0) {
    text('Paid', totalsLeftX, y, { size: 10, color: GREY });
    text(`-${fmt.format(inv.amountPaid)}`, totalsValueX, y, { size: 10, color: GREEN, align: 'right' });
    y -= 16;
  }

  page.drawLine({
    start: { x: totalsLeftX, y: y + 6 },
    end: { x: PAGE_W - MARGIN, y: y + 6 },
    thickness: 1.5,
    color: INK,
  });
  y -= 8;
  text('Amount Due', totalsLeftX, y, { size: 13, font: bold });
  text(fmt.format(inv.amountDue), totalsValueX, y, { size: 13, font: bold, color: CYAN, align: 'right' });
  y -= 30;

  // ---- Notes ------------------------------------------------------------
  if (inv.notes) {
    const noteLines = wrap(inv.notes, font, 9.5, CONTENT_W);
    newPageIfNeeded(20 + noteLines.length * 12);
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: PAGE_W - MARGIN, y: y + 6 },
      thickness: 0.5,
      color: RULE,
    });
    y -= 8;
    text('NOTES', MARGIN, y, { size: 8, color: LIGHT });
    y -= 14;
    for (const nl of noteLines) {
      text(nl, MARGIN, y, { size: 9.5, color: GREY });
      y -= 12;
    }
    y -= 8;
  }

  // ---- Payment link -----------------------------------------------------
  if (inv.stripePaymentLinkUrl) {
    newPageIfNeeded(20);
    text('Pay online:', MARGIN, y, { size: 9, color: GREY });
    text(inv.stripePaymentLinkUrl, MARGIN + 56, y, { size: 9, color: CYAN });
    y -= 16;
  }

  // ---- Footer (centered, bottom of last page) ---------------------------
  const footer = 'Thank you for your business.';
  const sub = 'Your KC Homes LLC - tolley.io';
  text(footer, PAGE_W / 2 - font.widthOfTextAtSize(footer, 9) / 2, MARGIN + 18, { size: 9, color: LIGHT });
  text(sub, PAGE_W / 2 - font.widthOfTextAtSize(sub, 9) / 2, MARGIN + 6, { size: 9, color: LIGHT });

  return pdf.save();
}
