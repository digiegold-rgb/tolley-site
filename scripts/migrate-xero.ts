// @ts-nocheck — Xero models removed from schema (cancelled 3/21)
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const prisma = new PrismaClient();
const XERO_DATA = '/home/jelly/xero-ledger/data';
const XERO_RULES = '/home/jelly/xero-ledger/rules';

function load(file: string) {
  return JSON.parse(readFileSync(path.join(XERO_DATA, file), 'utf-8'));
}

function loadRules(file: string) {
  return JSON.parse(readFileSync(path.join(XERO_RULES, file), 'utf-8'));
}

function classFromType(type: string): string {
  const map: Record<string, string> = {
    BANK: 'ASSET', CURRENT: 'ASSET', FIXED: 'ASSET', INVENTORY: 'ASSET',
    CURRLIAB: 'LIABILITY',
    EQUITY: 'EQUITY',
    REVENUE: 'REVENUE', SALES: 'REVENUE', OTHERINCOME: 'REVENUE',
    EXPENSE: 'EXPENSE', DIRECTCOSTS: 'EXPENSE', OVERHEADS: 'EXPENSE',
  };
  return map[type] || 'EXPENSE';
}

async function main() {
  console.log('=== Xero → Tolley.io Account Migration ===\n');

  // Phase 1: Chart of Accounts
  console.log('[1/5] Chart of Accounts...');
  const accounts = load('chart-of-accounts.json');
  let acctCount = 0;
  for (const a of accounts) {
    await prisma.ledgerAccount.upsert({
      where: { xeroId: a.accountID },
      create: {
        xeroId: a.accountID,
        code: a.code || null,
        name: a.name,
        type: a.type,
        class: classFromType(a.type),
        status: a.status || 'ACTIVE',
        taxType: a.taxType || 'NONE',
        isSystem: true,
      },
      update: {
        name: a.name,
        type: a.type,
        class: classFromType(a.type),
        status: a.status || 'ACTIVE',
      },
    });
    acctCount++;
  }
  console.log(`  → ${acctCount} accounts imported`);

  // Phase 2: Contacts
  console.log('[2/5] Contacts...');
  const contacts = load('contacts.json');
  let contactCount = 0;
  for (const c of contacts) {
    if (!c.name) continue;
    const email = c.emailAddress || c.addresses?.[0]?.email || null;
    const phone = c.phones?.find((p: any) => p.phoneNumber)?.phoneNumber || null;
    const addr = c.addresses?.find((a: any) => a.addressLine1);

    await prisma.accountContact.upsert({
      where: { xeroId: c.contactID },
      create: {
        xeroId: c.contactID,
        name: c.name,
        email,
        phone,
        address: addr?.addressLine1 || null,
        city: addr?.city || null,
        state: addr?.region || null,
        zip: addr?.postalCode || null,
        isCustomer: c.isCustomer || false,
        isSupplier: c.isSupplier || false,
        status: c.contactStatus === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED',
      },
      update: { name: c.name, email, phone },
    });
    contactCount++;
  }
  console.log(`  → ${contactCount} contacts imported`);

  // Phase 3: Categorization Rules
  console.log('[3/5] Categorization Rules...');
  const rulesData = loadRules('categories.json');
  let ruleCount = 0;
  for (let i = 0; i < rulesData.rules.length; i++) {
    const rule = rulesData.rules[i];
    const keywords = rule.match?.description || [];
    for (const kw of keywords) {
      await prisma.categorizationRule.create({
        data: {
          name: rule.name,
          priority: (i + 1) * 10,
          matchType: 'contains',
          matchField: 'description',
          matchValue: kw.toLowerCase(),
          accountCode: rule.account,
          note: rule.note || null,
          isActive: true,
          isSystem: true,
        },
      });
      ruleCount++;
    }
  }

  // Amount fallbacks
  try {
    const amountRules = loadRules('amount-fallbacks.json');
    const amtRules = amountRules.rules || {};
    for (const [amount, rule] of Object.entries(amtRules) as any) {
      await prisma.categorizationRule.create({
        data: {
          name: `Amount fallback ($${amount})`,
          priority: 9000,
          matchType: 'exact',
          matchField: 'amount',
          matchValue: amount,
          accountCode: rule.account,
          note: rule.note || null,
          isActive: true,
          isSystem: true,
        },
      });
      ruleCount++;
    }
  } catch { /* no amount rules file */ }
  console.log(`  → ${ruleCount} categorization rules imported`);

  // Phase 4: Invoices
  console.log('[4/5] Invoices...');
  const invoices = load('recent-invoices.json');
  let invCount = 0;
  for (const inv of invoices) {
    const statusMap: Record<string, string> = {
      AUTHORISED: 'SENT', PAID: 'PAID', VOIDED: 'VOID', DRAFT: 'DRAFT', DELETED: 'VOID',
    };
    const contact = inv.contact?.contactID
      ? await prisma.accountContact.findUnique({ where: { xeroId: inv.contact.contactID } })
      : null;

    await prisma.invoice.upsert({
      where: { xeroId: inv.invoiceID },
      create: {
        xeroId: inv.invoiceID,
        invoiceNumber: inv.invoiceNumber || `XERO-${invCount}`,
        contactId: contact?.id || null,
        status: statusMap[inv.status] || 'DRAFT',
        issueDate: inv.date ? new Date(inv.date) : new Date(),
        dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
        subTotal: inv.subTotal || 0,
        total: inv.total || 0,
        amountPaid: inv.amountPaid || 0,
        amountDue: inv.amountDue || 0,
        reference: inv.reference || null,
        paidAt: inv.status === 'PAID' && inv.fullyPaidOnDate ? new Date(inv.fullyPaidOnDate) : null,
        lineItems: {
          create: (inv.lineItems || []).map((li: any) => ({
            description: li.description || 'Imported from Xero',
            quantity: li.quantity || 1,
            unitAmount: li.unitAmount || inv.total || 0,
            lineAmount: li.lineAmount || inv.total || 0,
          })),
        },
      },
      update: {
        status: statusMap[inv.status] || 'DRAFT',
        amountPaid: inv.amountPaid || 0,
        amountDue: inv.amountDue || 0,
      },
    });
    invCount++;
  }
  console.log(`  → ${invCount} invoices imported`);

  // Phase 5: Transactions
  console.log('[5/5] Transactions...');
  const transactions = load('recent-transactions.json');
  let txCount = 0, txSkipped = 0;
  for (const txn of transactions) {
    const hash = createHash('sha256')
      .update(`${txn.date}|${txn.total}|${txn.reference || txn.contact?.name || txn.narration || ''}`)
      .digest('hex');

    const existing = await prisma.ledgerTransaction.findUnique({ where: { importHash: hash } });
    if (existing) { txSkipped++; continue; }

    const bankAcct = txn.bankAccount?.accountID
      ? await prisma.ledgerAccount.findUnique({ where: { xeroId: txn.bankAccount.accountID } })
      : null;
    const contact = txn.contact?.contactID
      ? await prisma.accountContact.findUnique({ where: { xeroId: txn.contact.contactID } })
      : null;
    const lineItem = txn.lineItems?.[0];
    const acctCode = lineItem?.accountCode || null;

    await prisma.ledgerTransaction.create({
      data: {
        xeroId: txn.bankTransactionID,
        date: new Date(txn.date),
        description: txn.reference || txn.contact?.name || txn.narration || 'Unknown',
        amount: txn.type === 'RECEIVE' ? Math.abs(txn.total) : -Math.abs(txn.total),
        type: txn.type || 'SPEND',
        bankAccountId: bankAcct?.id || null,
        accountCode: acctCode,
        contactId: contact?.id || null,
        isReconciled: txn.isReconciled || false,
        source: 'import',
        importHash: hash,
      },
    });
    txCount++;
  }
  console.log(`  → ${txCount} transactions imported (${txSkipped} skipped as duplicates)`);

  console.log('\n=== Migration Complete ===');
  const summary = {
    accounts: acctCount,
    contacts: contactCount,
    rules: ruleCount,
    invoices: invCount,
    transactions: txCount,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
