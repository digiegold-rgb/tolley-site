// @ts-nocheck — Xero models removed from schema (cancelled 3/21)
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

const XERO_LEDGER_URL = 'http://127.0.0.1:8920';

interface XeroAccount {
  accountID: string;
  code?: string;
  name: string;
  type: string;
  class: string;
  status: string;
  taxType?: string;
}

interface XeroBankAccount {
  accountID: string;
  code?: string;
  name: string;
  type: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  _class?: string;
  status: string;
}

interface XeroLineItem {
  accountCode?: string;
  description?: string;
  lineAmount?: number;
}

interface XeroTransaction {
  bankTransactionID: string;
  type: string;
  date: string;
  total: number;
  subTotal?: number;
  status: string;
  isReconciled?: boolean;
  contact?: { contactID?: string; name?: string };
  bankAccount?: { accountID?: string; name?: string };
  lineItems?: XeroLineItem[];
  reference?: string;
}

interface XeroInvoiceLineItem {
  description?: string;
  quantity?: number;
  unitAmount?: number;
  lineAmount?: number;
  accountCode?: string;
}

interface XeroInvoice {
  invoiceID: string;
  invoiceNumber?: string;
  type?: string;
  date?: string;
  dueDate?: string;
  status: string;
  total?: number;
  subTotal?: number;
  amountDue?: number;
  amountPaid?: number;
  contact?: { contactID?: string; name?: string };
  lineItems?: XeroInvoiceLineItem[];
  reference?: string;
}

interface XeroContact {
  contactID: string;
  name: string;
  emailAddress?: string;
  phones?: Array<{ phoneNumber?: string; phoneType?: string }>;
  addresses?: Array<{
    addressLine1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  }>;
  isCustomer?: boolean;
  isSupplier?: boolean;
  contactStatus?: string;
}

interface ExportData {
  accounts: XeroAccount[];
  bankAccounts: XeroBankAccount[];
  transactions: XeroTransaction[];
  invoices: XeroInvoice[];
  contacts: XeroContact[];
  counts: Record<string, number>;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const body = await request.json().catch(() => ({}));
    const triggerFresh = body.fresh === true;

    // Step 1: Optionally trigger a fresh sync from Xero
    if (triggerFresh) {
      try {
        await fetch(`${XERO_LEDGER_URL}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ live: false }),
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        // Non-critical — we'll use cached data
      }
    }

    // Step 2: Get all data from xero-ledger export
    const exportRes = await fetch(`${XERO_LEDGER_URL}/export/all`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!exportRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch data from Xero ledger' },
        { status: 502 },
      );
    }
    const data: ExportData = await exportRes.json();

    const results = {
      accounts: { upserted: 0, skipped: 0 },
      contacts: { upserted: 0, skipped: 0 },
      transactions: { upserted: 0, skipped: 0 },
      invoices: { upserted: 0, skipped: 0 },
    };

    // Step 3: Sync accounts (chart of accounts + bank accounts)
    const allAccounts = [
      ...data.accounts,
      ...data.bankAccounts.map((ba) => ({
        accountID: ba.accountID,
        code: ba.code || undefined,
        name: ba.name,
        type: ba.type || 'BANK',
        class: ba._class || 'ASSET',
        status: ba.status || 'ACTIVE',
        taxType: 'NONE',
      })),
    ];

    // Deduplicate by accountID
    const accountMap = new Map<string, XeroAccount>();
    for (const a of allAccounts) {
      accountMap.set(a.accountID, a);
    }

    for (const acct of accountMap.values()) {
      try {
        await prisma.ledgerAccount.upsert({
          where: { xeroId: acct.accountID },
          create: {
            xeroId: acct.accountID,
            code: acct.code || null,
            name: acct.name,
            type: acct.type,
            class: acct.class,
            status: acct.status || 'ACTIVE',
            taxType: acct.taxType || 'NONE',
          },
          update: {
            code: acct.code || undefined,
            name: acct.name,
            type: acct.type,
            class: acct.class,
            status: acct.status || 'ACTIVE',
          },
        });
        results.accounts.upserted++;
      } catch {
        results.accounts.skipped++;
      }
    }

    // Build lookup maps for FK resolution
    const dbAccounts = await prisma.ledgerAccount.findMany({
      select: { id: true, xeroId: true, code: true },
    });
    const xeroIdToAccountId = new Map(
      dbAccounts.filter((a) => a.xeroId).map((a) => [a.xeroId!, a.id]),
    );
    const codeToAccountId = new Map(
      dbAccounts.filter((a) => a.code).map((a) => [a.code!, a.id]),
    );

    // Step 4: Sync contacts
    for (const contact of data.contacts) {
      if (!contact.contactID) continue;
      const phone = contact.phones?.find((p) => p.phoneNumber)?.phoneNumber || null;
      const addr = contact.addresses?.[0];

      try {
        await prisma.accountContact.upsert({
          where: { xeroId: contact.contactID },
          create: {
            xeroId: contact.contactID,
            name: contact.name || 'Unknown',
            email: contact.emailAddress || null,
            phone,
            address: addr?.addressLine1 || null,
            city: addr?.city || null,
            state: addr?.region || null,
            zip: addr?.postalCode || null,
            isCustomer: contact.isCustomer ?? false,
            isSupplier: contact.isSupplier ?? false,
            status: contact.contactStatus || 'ACTIVE',
          },
          update: {
            name: contact.name || undefined,
            email: contact.emailAddress || undefined,
            phone: phone || undefined,
            isCustomer: contact.isCustomer ?? undefined,
            isSupplier: contact.isSupplier ?? undefined,
          },
        });
        results.contacts.upserted++;
      } catch {
        results.contacts.skipped++;
      }
    }

    // Build contact lookup
    const dbContacts = await prisma.accountContact.findMany({
      select: { id: true, xeroId: true },
    });
    const xeroIdToContactId = new Map(
      dbContacts.filter((c) => c.xeroId).map((c) => [c.xeroId!, c.id]),
    );

    // Step 5: Sync transactions
    for (const tx of data.transactions) {
      if (!tx.bankTransactionID) continue;

      const bankAccountId = tx.bankAccount?.accountID
        ? xeroIdToAccountId.get(tx.bankAccount.accountID) || null
        : null;
      const contactId = tx.contact?.contactID
        ? xeroIdToContactId.get(tx.contact.contactID) || null
        : null;
      const accountCode = tx.lineItems?.[0]?.accountCode || null;
      const description =
        tx.lineItems?.[0]?.description ||
        tx.contact?.name ||
        tx.reference ||
        'Unknown';

      try {
        await prisma.ledgerTransaction.upsert({
          where: { xeroId: tx.bankTransactionID },
          create: {
            xeroId: tx.bankTransactionID,
            date: new Date(tx.date),
            description,
            amount: Math.abs(tx.total),
            type: tx.type === 'RECEIVE' ? 'RECEIVE' : tx.type === 'SPEND' ? 'SPEND' : 'TRANSFER',
            bankAccountId,
            accountCode,
            contactId,
            isReconciled: tx.isReconciled ?? false,
            source: 'xero',
            needsReview: !accountCode,
          },
          update: {
            description,
            amount: Math.abs(tx.total),
            type: tx.type === 'RECEIVE' ? 'RECEIVE' : tx.type === 'SPEND' ? 'SPEND' : 'TRANSFER',
            bankAccountId,
            accountCode: accountCode || undefined,
            contactId,
            isReconciled: tx.isReconciled ?? undefined,
          },
        });
        results.transactions.upserted++;
      } catch {
        results.transactions.skipped++;
      }
    }

    // Step 6: Sync invoices
    for (const inv of data.invoices) {
      if (!inv.invoiceID) continue;

      const contactId = inv.contact?.contactID
        ? xeroIdToContactId.get(inv.contact.contactID) || null
        : null;
      const invoiceNumber = inv.invoiceNumber || `XERO-${inv.invoiceID.slice(0, 8)}`;

      // Map Xero invoice status to our status
      let status = 'DRAFT';
      if (inv.status === 'AUTHORISED') status = 'SENT';
      else if (inv.status === 'PAID') status = 'PAID';
      else if (inv.status === 'VOIDED') status = 'VOID';
      else if (inv.status === 'DRAFT') status = 'DRAFT';

      try {
        const existing = await prisma.invoice.findUnique({
          where: { xeroId: inv.invoiceID },
        });

        if (existing) {
          await prisma.invoice.update({
            where: { xeroId: inv.invoiceID },
            data: {
              status,
              total: inv.total || 0,
              subTotal: inv.subTotal || 0,
              amountDue: inv.amountDue || 0,
              amountPaid: inv.amountPaid || 0,
              ...(inv.dueDate ? { dueDate: new Date(inv.dueDate) } : {}),
            },
          });
        } else {
          // Check if invoiceNumber conflicts
          const numberConflict = await prisma.invoice.findUnique({
            where: { invoiceNumber },
          });
          const finalNumber = numberConflict
            ? `${invoiceNumber}-X${Date.now().toString(36)}`
            : invoiceNumber;

          const invoice = await prisma.invoice.create({
            data: {
              xeroId: inv.invoiceID,
              invoiceNumber: finalNumber,
              contactId,
              status,
              issueDate: inv.date ? new Date(inv.date) : new Date(),
              dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
              subTotal: inv.subTotal || 0,
              total: inv.total || 0,
              amountDue: inv.amountDue || 0,
              amountPaid: inv.amountPaid || 0,
              reference: inv.reference || null,
            },
          });

          // Create line items
          if (inv.lineItems && inv.lineItems.length > 0) {
            for (const li of inv.lineItems) {
              const accountId = li.accountCode
                ? codeToAccountId.get(li.accountCode) || null
                : null;
              await prisma.invoiceLineItem.create({
                data: {
                  invoiceId: invoice.id,
                  description: li.description || 'Line item',
                  quantity: li.quantity || 1,
                  unitAmount: li.unitAmount || 0,
                  lineAmount: li.lineAmount || 0,
                  accountId,
                },
              });
            }
          }
        }
        results.invoices.upserted++;
      } catch {
        results.invoices.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      results,
      totals: {
        accounts: results.accounts.upserted,
        contacts: results.contacts.upserted,
        transactions: results.transactions.upserted,
        invoices: results.invoices.upserted,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
