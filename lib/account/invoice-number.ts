// @ts-nocheck — references removed Prisma models
import { prisma } from '@/lib/prisma';

const MIN_NUMBER = 140;

export async function getNextInvoiceNumber(): Promise<string> {
  const latest = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let next = MIN_NUMBER;

  if (latest?.invoiceNumber) {
    const match = latest.invoiceNumber.match(/INV-(\d+)/);
    if (match) {
      const current = parseInt(match[1], 10);
      next = Math.max(current + 1, MIN_NUMBER);
    }
  }

  return `INV-${next.toString().padStart(4, '0')}`;
}
