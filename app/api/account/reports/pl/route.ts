// @ts-nocheck — Xero models removed from schema (cancelled 3/21)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

interface PLEntry {
  code: string;
  name: string;
  total: number;
  priorTotal: number;
  change: number;
}

async function buildPL(from?: string, to?: string) {
  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const where: Record<string, unknown> = {};
  if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

  const transactions = await prisma.ledgerTransaction.findMany({
    where,
    select: { accountCode: true, amount: true, type: true },
  });

  const accounts = await prisma.ledgerAccount.findMany({
    select: { code: true, name: true, class: true, type: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a]));

  const grouped: Record<string, { total: number; type: string }> = {};
  for (const tx of transactions) {
    const code = tx.accountCode || 'UNCATEGORIZED';
    if (!grouped[code]) grouped[code] = { total: 0, type: tx.type };
    grouped[code].total += tx.amount;
  }

  const revenue: { code: string; name: string; total: number }[] = [];
  const expenses: { code: string; name: string; total: number }[] = [];

  for (const [code, data] of Object.entries(grouped)) {
    const acct = accountMap.get(code);
    const entry = {
      code,
      name: acct?.name || code,
      total: Math.round(data.total * 100) / 100,
    };
    const acctClass = acct?.class?.toUpperCase();
    if (acctClass === 'REVENUE' || data.type === 'RECEIVE') {
      revenue.push(entry);
    } else if (acctClass === 'EXPENSE' || data.type === 'SPEND') {
      expenses.push(entry);
    }
  }

  revenue.sort((a, b) => b.total - a.total);
  expenses.sort((a, b) => b.total - a.total);

  const totalRevenue = revenue.reduce((s, r) => s + r.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.total, 0);

  return {
    revenue,
    expenses,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netIncome: Math.round((totalRevenue - totalExpenses) * 100) / 100,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const { searchParams } = request.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const compare = searchParams.get('compare'); // 'prior-year' or 'prior-period'

    // Current period P&L
    const current = await buildPL(from || undefined, to || undefined);

    // Comparison period
    let prior = null;
    if (compare && from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const periodMs = toDate.getTime() - fromDate.getTime();

      let priorFrom: Date;
      let priorTo: Date;

      if (compare === 'prior-year') {
        priorFrom = new Date(fromDate);
        priorFrom.setFullYear(priorFrom.getFullYear() - 1);
        priorTo = new Date(toDate);
        priorTo.setFullYear(priorTo.getFullYear() - 1);
      } else {
        // prior-period: shift back by the same duration
        priorTo = new Date(fromDate.getTime() - 1);
        priorFrom = new Date(priorTo.getTime() - periodMs);
      }

      prior = await buildPL(
        priorFrom.toISOString().split('T')[0],
        priorTo.toISOString().split('T')[0],
      );
    }

    // Merge current and prior into comparison entries
    if (prior) {
      const priorRevenueMap = new Map(prior.revenue.map((r) => [r.code, r.total]));
      const priorExpenseMap = new Map(prior.expenses.map((e) => [e.code, e.total]));

      const revenueComparison: PLEntry[] = current.revenue.map((r) => {
        const priorTotal = priorRevenueMap.get(r.code) || 0;
        return {
          ...r,
          priorTotal,
          change: r.total - priorTotal,
        };
      });

      // Add prior-period items not in current
      for (const pr of prior.revenue) {
        if (!current.revenue.find((r) => r.code === pr.code)) {
          revenueComparison.push({
            code: pr.code,
            name: pr.name,
            total: 0,
            priorTotal: pr.total,
            change: -pr.total,
          });
        }
      }

      const expenseComparison: PLEntry[] = current.expenses.map((e) => {
        const priorTotal = priorExpenseMap.get(e.code) || 0;
        return {
          ...e,
          priorTotal,
          change: e.total - priorTotal,
        };
      });

      for (const pe of prior.expenses) {
        if (!current.expenses.find((e) => e.code === pe.code)) {
          expenseComparison.push({
            code: pe.code,
            name: pe.name,
            total: 0,
            priorTotal: pe.total,
            change: -pe.total,
          });
        }
      }

      return NextResponse.json({
        ...current,
        comparison: {
          revenue: revenueComparison,
          expenses: expenseComparison,
          priorTotalRevenue: prior.totalRevenue,
          priorTotalExpenses: prior.totalExpenses,
          priorNetIncome: prior.netIncome,
          revenueChange: current.totalRevenue - prior.totalRevenue,
          expenseChange: current.totalExpenses - prior.totalExpenses,
          netIncomeChange: current.netIncome - prior.netIncome,
        },
      });
    }

    return NextResponse.json(current);
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
