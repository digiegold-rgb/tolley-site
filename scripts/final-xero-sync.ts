// One-off final Xero sync — pulls from xero-ledger /export/all and upserts into Neon.
// Run: cd /home/jelly/tolley-site && npx tsx scripts/final-xero-sync.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEDGER_URL = 'http://127.0.0.1:8920';
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || 'b9a081c92e68b3f874636bf6c687754edb130136312d012627bdbd61d6f584ed';

type XeroAccount = { accountID: string; code?: string; name: string; type: string; class?: string; status?: string; taxType?: string };
type XeroBank = { accountID: string; code?: string; name: string; type?: string; _class?: string; status?: string };
type XeroTxn = { bankTransactionID: string; type: string; date: string; total: number; isReconciled?: boolean; contact?: { contactID?: string; name?: string }; bankAccount?: { accountID?: string }; lineItems?: Array<{ accountCode?: string; description?: string }>; reference?: string };
type XeroContact = { contactID: string; name: string; emailAddress?: string; phones?: Array<{ phoneNumber?: string }>; addresses?: Array<{ addressLine1?: string; city?: string; region?: string; postalCode?: string }>; isCustomer?: boolean; isSupplier?: boolean; contactStatus?: string };
type XeroInvoice = { invoiceID: string; invoiceNumber?: string; date?: string; dueDate?: string; status: string; total?: number; subTotal?: number; amountDue?: number; amountPaid?: number; contact?: { contactID?: string }; lineItems?: Array<{ description?: string; quantity?: number; unitAmount?: number; lineAmount?: number; accountCode?: string }>; reference?: string };

async function main() {
  console.log('[1/6] Fetching /export/all...');
  const res = await fetch(`${LEDGER_URL}/export/all`, {
    headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const data = await res.json() as {
    accounts: XeroAccount[];
    bankAccounts: XeroBank[];
    transactions: XeroTxn[];
    contacts: XeroContact[];
    invoices: XeroInvoice[];
    counts: Record<string, number>;
  };
  console.log('  counts:', data.counts);

  console.log('[2/6] Accounts...');
  const allAccounts = [
    ...data.accounts,
    ...data.bankAccounts.map(b => ({ accountID: b.accountID, code: b.code, name: b.name, type: b.type || 'BANK', class: b._class || 'ASSET', status: b.status || 'ACTIVE', taxType: 'NONE' as const })),
  ];
  const seen = new Map<string, XeroAccount>();
  for (const a of allAccounts) seen.set(a.accountID, a);
  let acctCount = 0;
  for (const a of seen.values()) {
    try {
      await prisma.ledgerAccount.upsert({
        where: { xeroId: a.accountID },
        create: { xeroId: a.accountID, code: a.code || null, name: a.name, type: a.type, class: a.class || 'EXPENSE', status: a.status || 'ACTIVE', taxType: a.taxType || 'NONE' },
        update: { code: a.code || undefined, name: a.name, type: a.type, class: a.class || undefined, status: a.status || undefined },
      });
      acctCount++;
    } catch (e) { console.error(`  skip acct ${a.name}:`, (e as Error).message); }
  }
  console.log(`  upserted ${acctCount}`);

  console.log('[3/6] Contacts...');
  let contactCount = 0;
  for (const c of data.contacts) {
    if (!c.contactID) continue;
    const phone = c.phones?.find(p => p.phoneNumber)?.phoneNumber || null;
    const addr = c.addresses?.[0];
    try {
      await prisma.accountContact.upsert({
        where: { xeroId: c.contactID },
        create: { xeroId: c.contactID, name: c.name || 'Unknown', email: c.emailAddress || null, phone, address: addr?.addressLine1 || null, city: addr?.city || null, state: addr?.region || null, zip: addr?.postalCode || null, isCustomer: c.isCustomer ?? false, isSupplier: c.isSupplier ?? false, status: c.contactStatus || 'ACTIVE' },
        update: { name: c.name || undefined, email: c.emailAddress || undefined, phone: phone || undefined },
      });
      contactCount++;
    } catch (e) { console.error(`  skip contact ${c.name}:`, (e as Error).message); }
  }
  console.log(`  upserted ${contactCount}`);

  console.log('[4/6] Building FK maps...');
  const dbAccts = await prisma.ledgerAccount.findMany({ select: { id: true, xeroId: true, code: true } });
  const xeroToAcctId = new Map(dbAccts.filter(a => a.xeroId).map(a => [a.xeroId!, a.id]));
  const codeToAcctId = new Map(dbAccts.filter(a => a.code).map(a => [a.code!, a.id]));
  const dbContacts = await prisma.accountContact.findMany({ select: { id: true, xeroId: true } });
  const xeroToContactId = new Map(dbContacts.filter(c => c.xeroId).map(c => [c.xeroId!, c.id]));

  console.log('[5/6] Transactions...');
  let txnCount = 0, txnSkip = 0;
  for (const tx of data.transactions) {
    if (!tx.bankTransactionID) continue;
    const bankAccountId = tx.bankAccount?.accountID ? xeroToAcctId.get(tx.bankAccount.accountID) || null : null;
    const contactId = tx.contact?.contactID ? xeroToContactId.get(tx.contact.contactID) || null : null;
    const accountCode = tx.lineItems?.[0]?.accountCode || null;
    const description = tx.lineItems?.[0]?.description || tx.contact?.name || tx.reference || 'Unknown';
    try {
      await prisma.ledgerTransaction.upsert({
        where: { xeroId: tx.bankTransactionID },
        create: { xeroId: tx.bankTransactionID, date: new Date(tx.date), description, amount: Math.abs(tx.total), type: tx.type === 'RECEIVE' ? 'RECEIVE' : tx.type === 'SPEND' ? 'SPEND' : 'TRANSFER', bankAccountId, accountCode, contactId, isReconciled: tx.isReconciled ?? false, source: 'xero', needsReview: !accountCode },
        update: { description, amount: Math.abs(tx.total), bankAccountId, accountCode: accountCode || undefined, contactId },
      });
      txnCount++;
    } catch { txnSkip++; }
  }
  console.log(`  upserted ${txnCount}, skipped ${txnSkip}`);

  console.log('[6/6] Invoices...');
  let invCount = 0, invSkip = 0, liCount = 0;
  for (const inv of data.invoices) {
    if (!inv.invoiceID) continue;
    const contactId = inv.contact?.contactID ? xeroToContactId.get(inv.contact.contactID) || null : null;
    const invoiceNumber = inv.invoiceNumber || `XERO-${inv.invoiceID.slice(0, 8)}`;
    const status = inv.status === 'AUTHORISED' ? 'SENT' : inv.status === 'PAID' ? 'PAID' : inv.status === 'VOIDED' ? 'VOID' : 'DRAFT';
    try {
      const existing = await prisma.invoice.findUnique({ where: { xeroId: inv.invoiceID } });
      if (existing) {
        await prisma.invoice.update({
          where: { xeroId: inv.invoiceID },
          data: { status, total: inv.total || 0, subTotal: inv.subTotal || 0, amountDue: inv.amountDue || 0, amountPaid: inv.amountPaid || 0, ...(inv.dueDate ? { dueDate: new Date(inv.dueDate) } : {}) },
        });
      } else {
        const conflict = await prisma.invoice.findUnique({ where: { invoiceNumber } });
        const finalNumber = conflict ? `${invoiceNumber}-X${Date.now().toString(36)}` : invoiceNumber;
        const created = await prisma.invoice.create({
          data: { xeroId: inv.invoiceID, invoiceNumber: finalNumber, contactId, status, issueDate: inv.date ? new Date(inv.date) : new Date(), dueDate: inv.dueDate ? new Date(inv.dueDate) : null, subTotal: inv.subTotal || 0, total: inv.total || 0, amountDue: inv.amountDue || 0, amountPaid: inv.amountPaid || 0, reference: inv.reference || null },
        });
        if (inv.lineItems?.length) {
          for (const li of inv.lineItems) {
            const accountId = li.accountCode ? codeToAcctId.get(li.accountCode) || null : null;
            await prisma.invoiceLineItem.create({
              data: { invoiceId: created.id, description: li.description || 'Line item', quantity: li.quantity || 1, unitAmount: li.unitAmount || 0, lineAmount: li.lineAmount || 0, accountId },
            });
            liCount++;
          }
        }
      }
      invCount++;
    } catch (e) {
      invSkip++;
      console.error(`  skip inv ${inv.invoiceNumber}:`, (e as Error).message);
    }
  }
  console.log(`  upserted ${invCount}, new line items ${liCount}, skipped ${invSkip}`);

  const totals = await Promise.all([
    prisma.invoice.count(),
    prisma.accountContact.count(),
    prisma.ledgerAccount.count(),
    prisma.ledgerTransaction.count(),
  ]);
  console.log('\n=== FINAL DB STATE ===');
  console.log(`invoices: ${totals[0]}, contacts: ${totals[1]}, accounts: ${totals[2]}, transactions: ${totals[3]}`);

  const buckeye = await prisma.accountContact.findMany({
    where: { name: { contains: 'Buckeye', mode: 'insensitive' } },
    include: { _count: { select: { invoices: true } } },
  });
  console.log('\nBuckeye contacts:');
  for (const b of buckeye) console.log(`  ${b.name} — ${b._count.invoices} invoices`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
