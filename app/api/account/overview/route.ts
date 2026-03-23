// @ts-nocheck — Xero models removed from schema (cancelled 3/21)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireAdminApiSession();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Prior month: same day range in previous month
    const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const priorMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prior month

    // Prior year same month
    const priorYearMonthStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const priorYearMonthEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);

    // Prior year full
    const priorYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const priorYearEnd = new Date(now.getFullYear() - 1, 11, 31);

    const [
      revenueAgg,
      expenseAgg,
      unpaidInvoices,
      uncategorizedTx,
      recentTransactions,
      // YTD
      revenueYTD,
      expenseYTD,
      // Prior month
      revenuePriorMonth,
      expensePriorMonth,
      // Prior year same month
      revenuePriorYearMonth,
      expensePriorYearMonth,
      // Prior year full
      revenuePriorYear,
      expensePriorYear,
      // Totals
      totalTransactions,
      totalAccounts,
      totalContacts,
      totalInvoices,
      // Date range
      oldestTx,
      newestTx,
    ] = await Promise.all([
      // Current MTD
      prisma.ledgerTransaction.aggregate({
        where: { type: 'RECEIVE', date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.ledgerTransaction.aggregate({
        where: { type: 'SPEND', date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: { status: { in: ['SENT', 'OVERDUE'] } },
      }),
      prisma.ledgerTransaction.count({
        where: { needsReview: true },
      }),
      prisma.ledgerTransaction.findMany({
        orderBy: { date: 'desc' },
        take: 20,
        include: { bankAccount: { select: { name: true } } },
      }),
      // YTD
      prisma.ledgerTransaction.aggregate({
        where: { type: 'RECEIVE', date: { gte: yearStart } },
        _sum: { amount: true },
      }),
      prisma.ledgerTransaction.aggregate({
        where: { type: 'SPEND', date: { gte: yearStart } },
        _sum: { amount: true },
      }),
      // Prior month
      prisma.ledgerTransaction.aggregate({
        where: { type: 'RECEIVE', date: { gte: priorMonthStart, lte: priorMonthEnd } },
        _sum: { amount: true },
      }),
      prisma.ledgerTransaction.aggregate({
        where: { type: 'SPEND', date: { gte: priorMonthStart, lte: priorMonthEnd } },
        _sum: { amount: true },
      }),
      // Prior year same month
      prisma.ledgerTransaction.aggregate({
        where: { type: 'RECEIVE', date: { gte: priorYearMonthStart, lte: priorYearMonthEnd } },
        _sum: { amount: true },
      }),
      prisma.ledgerTransaction.aggregate({
        where: { type: 'SPEND', date: { gte: priorYearMonthStart, lte: priorYearMonthEnd } },
        _sum: { amount: true },
      }),
      // Prior year full
      prisma.ledgerTransaction.aggregate({
        where: { type: 'RECEIVE', date: { gte: priorYearStart, lte: priorYearEnd } },
        _sum: { amount: true },
      }),
      prisma.ledgerTransaction.aggregate({
        where: { type: 'SPEND', date: { gte: priorYearStart, lte: priorYearEnd } },
        _sum: { amount: true },
      }),
      // Counts
      prisma.ledgerTransaction.count(),
      prisma.ledgerAccount.count(),
      prisma.accountContact.count(),
      prisma.invoice.count(),
      // Date range
      prisma.ledgerTransaction.findFirst({ orderBy: { date: 'asc' }, select: { date: true } }),
      prisma.ledgerTransaction.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
    ]);

    const revenueMTD = revenueAgg._sum.amount || 0;
    const expensesMTD = expenseAgg._sum.amount || 0;

    return NextResponse.json({
      // Current MTD
      revenueMTD,
      expensesMTD,
      netMTD: revenueMTD - expensesMTD,
      unpaidInvoices,
      uncategorizedTx,
      recentTransactions,
      // YTD
      revenueYTD: revenueYTD._sum.amount || 0,
      expensesYTD: expenseYTD._sum.amount || 0,
      netYTD: (revenueYTD._sum.amount || 0) - (expenseYTD._sum.amount || 0),
      // Prior month
      revenuePriorMonth: revenuePriorMonth._sum.amount || 0,
      expensesPriorMonth: expensePriorMonth._sum.amount || 0,
      netPriorMonth:
        (revenuePriorMonth._sum.amount || 0) - (expensePriorMonth._sum.amount || 0),
      // Prior year same month
      revenuePriorYearMonth: revenuePriorYearMonth._sum.amount || 0,
      expensesPriorYearMonth: expensePriorYearMonth._sum.amount || 0,
      netPriorYearMonth:
        (revenuePriorYearMonth._sum.amount || 0) - (expensePriorYearMonth._sum.amount || 0),
      // Prior year full
      revenuePriorYear: revenuePriorYear._sum.amount || 0,
      expensesPriorYear: expensePriorYear._sum.amount || 0,
      netPriorYear:
        (revenuePriorYear._sum.amount || 0) - (expensePriorYear._sum.amount || 0),
      // Database stats
      dbStats: {
        totalTransactions,
        totalAccounts,
        totalContacts,
        totalInvoices,
        dateRange: {
          oldest: oldestTx?.date || null,
          newest: newestTx?.date || null,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
