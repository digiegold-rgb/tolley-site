import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.accountContact.findMany({
    where: {
      OR: [
        { name: { contains: 'Buckeye', mode: 'insensitive' } },
        { email: { contains: 'buckeye', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
  });
  console.log('CONTACTS:', JSON.stringify(contacts, null, 2));

  if (!contacts.length) return;
  const ids = contacts.map(c => c.id);

  const invoices = await prisma.invoice.findMany({
    where: { contactId: { in: ids } },
    orderBy: { issueDate: 'asc' },
    select: {
      id: true,
      invoiceNumber: true,
      reference: true,
      status: true,
      issueDate: true,
      dueDate: true,
      total: true,
      amountPaid: true,
      amountDue: true,
      xeroId: true,
      sentAt: true,
      paidAt: true,
      contact: { select: { name: true } },
      _count: { select: { attachments: true, payments: true, lineItems: true } },
    },
  });

  console.log('\nINVOICE COUNT:', invoices.length);
  console.log('\n# | invoiceNumber | reference | status | total | paid | due | sentAt | paidAt | xeroId | atts');
  for (const i of invoices) {
    console.log(
      [
        i.id.slice(0, 8),
        i.invoiceNumber,
        i.reference ?? '-',
        i.status,
        i.total,
        i.amountPaid,
        i.amountDue,
        i.sentAt?.toISOString().slice(0, 10) ?? '-',
        i.paidAt?.toISOString().slice(0, 10) ?? '-',
        i.xeroId ? 'XERO' : 'NEW',
        i._count.attachments,
      ].join(' | ')
    );
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
