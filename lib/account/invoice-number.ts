import { prisma } from '@/lib/prisma';

const MIN_NUMBER = 140;
const PREFIX = 'INV-';
const PAD = 4;

function extractNumber(invoiceNumber: string): number {
  const match = invoiceNumber.match(/INV-0*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function format(n: number): string {
  return `${PREFIX}${n.toString().padStart(PAD, '0')}`;
}

export async function getNextInvoiceNumber(): Promise<string> {
  // Pull only numeric INV-* invoices; string sort is unreliable across padding widths.
  const candidates = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: PREFIX } },
    select: { invoiceNumber: true },
  });

  let highest = MIN_NUMBER - 1;
  for (const c of candidates) {
    const n = extractNumber(c.invoiceNumber);
    if (n > highest) highest = n;
  }

  let candidate = Math.max(highest + 1, MIN_NUMBER);

  for (let i = 0; i < 20; i++) {
    const formatted = format(candidate);
    const exists = await prisma.invoice.findUnique({
      where: { invoiceNumber: formatted },
      select: { id: true },
    });
    if (!exists) return formatted;
    candidate++;
  }

  throw new Error(`Could not allocate invoice number after 20 attempts (tried up to ${format(candidate)})`);
}

// Buckeye pays against its own clean, UNPADDED sequence (INV-144, 145 … 152).
// Alicia matches invoices by number, so a Buckeye draft must continue THAT
// sequence, not the global padded counter (which produces artifacts like
// INV-0311). Guadalupe Centers drops are billed to Buckeye and share it.
// Falls back to the global numberer if — impossibly — no numbered Buckeye
// invoice exists yet (never emit INV-1).
const BUCKEYE_SEQ = /^INV-([1-9]\d*)$/;

export async function getNextBuckeyeInvoiceNumber(): Promise<string> {
  const contacts = await prisma.accountContact.findMany({
    where: { name: { contains: 'Buckeye', mode: 'insensitive' } },
    select: { id: true },
  });
  const ids = contacts.map((c) => c.id);
  if (ids.length === 0) return getNextInvoiceNumber();

  const invs = await prisma.invoice.findMany({
    where: { contactId: { in: ids } },
    select: { invoiceNumber: true },
  });

  let highest = 0;
  for (const i of invs) {
    const m = BUCKEYE_SEQ.exec(i.invoiceNumber);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > highest) highest = n;
    }
  }
  if (highest === 0) return getNextInvoiceNumber();

  let candidate = highest + 1;
  for (let i = 0; i < 20; i++) {
    const formatted = `${PREFIX}${candidate}`; // UNPADDED
    const exists = await prisma.invoice.findUnique({
      where: { invoiceNumber: formatted },
      select: { id: true },
    });
    if (!exists) return formatted;
    candidate++;
  }
  throw new Error(`Could not allocate Buckeye invoice number after 20 attempts (up to INV-${candidate})`);
}
