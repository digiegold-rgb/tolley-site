import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const renames = [
  { from: 'INV-0142', to: 'INV-142' },
  { from: 'INV-0143', to: 'INV-143' },
  { from: 'INV-0148', to: 'INV-144' },
  { from: 'INV-0152', to: 'INV-145' },
  { from: 'INV-0156', to: 'INV-146' },
];

async function main() {
  console.log('--- collision check ---');
  for (const r of renames) {
    const collide = await prisma.invoice.findUnique({
      where: { invoiceNumber: r.to },
      select: { id: true, invoiceNumber: true, contact: { select: { name: true } } },
    });
    console.log(r.to, collide ? `COLLIDES with ${collide.id} (${collide.contact?.name})` : 'free');
  }

  console.log('\n--- attachments + payments per target invoice ---');
  for (const r of renames) {
    const inv = await prisma.invoice.findUnique({
      where: { invoiceNumber: r.from },
      include: {
        attachments: { select: { id: true, fileName: true, blobUrl: true, size: true, mimeType: true, uploadedAt: true } },
        payments: { select: { id: true, amount: true, paidAt: true, method: true, reference: true } },
        lineItems: { select: { description: true, quantity: true, unitAmount: true, lineAmount: true } },
        contact: { select: { name: true, email: true } },
      },
    });
    console.log(`\n${r.from} → ${r.to}  (status=${inv?.status}, total=${inv?.total}, paid=${inv?.amountPaid}, due=${inv?.amountDue})`);
    console.log('  contact:', inv?.contact?.name, inv?.contact?.email);
    console.log('  lineItems:', inv?.lineItems);
    console.log('  attachments:', inv?.attachments);
    console.log('  payments:', inv?.payments);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
