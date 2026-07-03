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
