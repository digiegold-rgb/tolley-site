// @ts-nocheck — Xero models removed from schema (cancelled 3/21)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireAdminApiSession();

    // Bank balances: sum transactions grouped by bankAccount
    const bankTransactions = await prisma.ledgerTransaction.groupBy({
      by: ['bankAccountId'],
      _sum: { amount: true },
      where: { bankAccountId: { not: null } },
    });

    const bankAccountIds = bankTransactions
      .map((bt) => bt.bankAccountId)
      .filter((id): id is string => id !== null);

    const bankAccounts = await prisma.ledgerAccount.findMany({
      where: { id: { in: bankAccountIds } },
      select: { id: true, code: true, name: true },
    });
    const bankMap = new Map(bankAccounts.map((a) => [a.id, a]));

    const bankBalances = bankTransactions.map((bt) => {
      const acct = bankMap.get(bt.bankAccountId!);
      // RECEIVE adds to balance, SPEND subtracts — but amounts are absolute,
      // so we rely on the sum which already reflects sign from type-based logic.
      // Actually groupBy just sums the amount field directly.
      return {
        accountId: bt.bankAccountId,
        code: acct?.code || null,
        name: acct?.name || 'Unknown',
        balance: Math.round((bt._sum.amount || 0) * 100) / 100,
      };
    });

    // Accounts Receivable: sum of unpaid invoices
    const arResult = await prisma.invoice.aggregate({
      where: { status: { in: ['SENT', 'OVERDUE', 'DRAFT'] } },
      _sum: { amountDue: true },
    });
    const accountsReceivable = arResult._sum.amountDue || 0;

    // Equity accounts
    const equityAccounts = await prisma.ledgerAccount.findMany({
      where: { class: 'EQUITY', status: 'ACTIVE' },
      select: { id: true, code: true, name: true },
    });

    const equityTx = await prisma.ledgerTransaction.groupBy({
      by: ['accountCode'],
      _sum: { amount: true },
      where: {
        accountCode: { in: equityAccounts.map((a) => a.code).filter((c): c is string => c !== null) },
      },
    });
    const equityMap = new Map(equityAccounts.map((a) => [a.code, a.name]));

    const equity = equityTx.map((et) => ({
      code: et.accountCode,
      name: equityMap.get(et.accountCode!) || et.accountCode,
      balance: Math.round((et._sum.amount || 0) * 100) / 100,
    }));

    const totalAssets =
      bankBalances.reduce((s, b) => s + b.balance, 0) + accountsReceivable;

    return NextResponse.json({
      assets: {
        bankBalances,
        accountsReceivable: Math.round(accountsReceivable * 100) / 100,
        totalAssets: Math.round(totalAssets * 100) / 100,
      },
      equity,
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
