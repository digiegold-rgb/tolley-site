'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'RECEIVE' | 'SPEND';
  accountCode: string | null;
  bankAccount?: { name: string } | null;
}

interface Overview {
  revenueMTD: number;
  expensesMTD: number;
  netMTD: number;
  unpaidInvoices: number;
  uncategorizedTx: number;
  recentTransactions: Transaction[];
  // YTD
  revenueYTD: number;
  expensesYTD: number;
  netYTD: number;
  // Prior month
  revenuePriorMonth: number;
  expensesPriorMonth: number;
  netPriorMonth: number;
  // Prior year same month
  revenuePriorYearMonth: number;
  expensesPriorYearMonth: number;
  netPriorYearMonth: number;
  // Prior year full
  revenuePriorYear: number;
  expensesPriorYear: number;
  netPriorYear: number;
  // DB stats
  dbStats: {
    totalTransactions: number;
    totalAccounts: number;
    totalContacts: number;
    totalInvoices: number;
    dateRange: { oldest: string | null; newest: string | null };
  };
}

function ChangeBadge({ current, prior }: { current: number; prior: number }) {
  if (prior === 0) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const isUp = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
        isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
      }`}
    >
      {isUp ? '\u25B2' : '\u25BC'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/account/overview');
      if (!res.ok) throw new Error('Failed to load overview');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncXero = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/account/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        const t = json.totals;
        setSyncResult(
          `Synced: ${t.accounts} accounts, ${t.transactions} transactions, ${t.invoices} invoices, ${t.contacts} contacts`,
        );
        fetchData();
      } else {
        setSyncResult(`Sync error: ${json.error}`);
      }
    } catch (e) {
      setSyncResult(`Sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const monthlyData = buildMonthlyData(data.recentTransactions);

  // Primary stat cards — MTD with comparisons
  const primaryStats = [
    {
      label: 'Revenue MTD',
      value: fmt.format(data.revenueMTD),
      color: 'text-emerald-400',
      prior: data.revenuePriorMonth,
      current: data.revenueMTD,
      priorLabel: 'vs prior month',
    },
    {
      label: 'Expenses MTD',
      value: fmt.format(data.expensesMTD),
      color: 'text-red-400',
      prior: data.expensesPriorMonth,
      current: data.expensesMTD,
      priorLabel: 'vs prior month',
    },
    {
      label: 'Net MTD',
      value: fmt.format(data.netMTD),
      color: data.netMTD >= 0 ? 'text-cyan-400' : 'text-red-400',
      prior: data.netPriorMonth,
      current: data.netMTD,
      priorLabel: 'vs prior month',
    },
    {
      label: 'Unpaid Invoices',
      value: String(data.unpaidInvoices),
      color: 'text-amber-400',
      prior: 0,
      current: 0,
      priorLabel: '',
    },
  ];

  // YTD + Prior Year cards
  const secondaryStats = [
    {
      label: 'Revenue YTD',
      value: fmt.format(data.revenueYTD),
      color: 'text-emerald-400',
      sub: data.revenuePriorYear > 0 ? `Prior year: ${fmt.format(data.revenuePriorYear)}` : null,
    },
    {
      label: 'Expenses YTD',
      value: fmt.format(data.expensesYTD),
      color: 'text-red-400',
      sub: data.expensesPriorYear > 0 ? `Prior year: ${fmt.format(data.expensesPriorYear)}` : null,
    },
    {
      label: 'Net YTD',
      value: fmt.format(data.netYTD),
      color: data.netYTD >= 0 ? 'text-cyan-400' : 'text-red-400',
      sub: data.netPriorYear !== 0 ? `Prior year: ${fmt.format(data.netPriorYear)}` : null,
    },
    {
      label: 'Prior Year Net',
      value: data.netPriorYear !== 0 ? fmt.format(data.netPriorYear) : 'No data',
      color: data.netPriorYear >= 0 ? 'text-purple-400' : 'text-red-400',
      sub: data.revenuePriorYear > 0
        ? `Rev: ${fmt.format(data.revenuePriorYear)} | Exp: ${fmt.format(data.expensesPriorYear)}`
        : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sync Bar */}
      <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="text-xs text-white/40">
            {data.dbStats.totalTransactions} transactions |{' '}
            {data.dbStats.dateRange.oldest
              ? new Date(data.dbStats.dateRange.oldest).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}{' '}
            to{' '}
            {data.dbStats.dateRange.newest
              ? new Date(data.dbStats.dateRange.newest).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </div>
          {syncResult && (
            <span
              className={`text-xs ${syncResult.includes('error') || syncResult.includes('failed') ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {syncResult}
            </span>
          )}
        </div>
        <button
          onClick={syncXero}
          disabled={syncing}
          className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {syncing ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border border-cyan-400 border-t-transparent" />
              Syncing...
            </>
          ) : (
            'Sync from Xero'
          )}
        </button>
      </div>

      {/* Primary Stats — MTD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryStats.map((s) => (
          <div
            key={s.label}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">{s.label}</p>
              {s.prior !== 0 && s.current !== 0 && (
                <ChangeBadge current={s.current} prior={s.prior} />
              )}
            </div>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            {s.prior !== 0 && (
              <p className="text-[10px] text-white/30 mt-1">
                {s.priorLabel}: {fmt.format(s.prior)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Secondary Stats — YTD + Prior Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryStats.map((s) => (
          <div
            key={s.label}
            className="bg-white/[0.02] border border-white/[0.06] rounded-xl backdrop-blur-sm p-4"
          >
            <p className="text-xs text-white/50">{s.label}</p>
            <p className={`text-lg font-semibold mt-0.5 ${s.color}`}>{s.value}</p>
            {s.sub && <p className="text-[10px] text-white/25 mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5">
          <h2 className="text-sm font-semibold text-white/60 mb-4">Revenue vs Expenses</h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f0e17',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value) => fmt.format(Number(value))}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/40 text-sm py-10 text-center">No transaction data for chart</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 mb-2">Quick Actions</h2>
          <Link
            href="/account/invoices/new"
            className="block w-full text-center bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            New Invoice
          </Link>
          <Link
            href="/account/transactions"
            className="block w-full text-center bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-4 py-2.5 transition-colors"
          >
            Import Transactions
          </Link>
          <Link
            href="/account/reports"
            className="block w-full text-center bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-4 py-2.5 transition-colors"
          >
            View Reports
          </Link>
          {data.uncategorizedTx > 0 && (
            <Link
              href="/account/transactions?needsReview=true"
              className="block w-full text-center bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg px-4 py-2.5 transition-colors"
            >
              {data.uncategorizedTx} Need Review
            </Link>
          )}

          {/* DB Stats */}
          <div className="pt-3 mt-3 border-t border-white/[0.08] space-y-1.5">
            <h3 className="text-xs text-white/40 font-medium">Database</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span className="text-white/30">Transactions</span>
              <span className="text-white/60 text-right">{data.dbStats.totalTransactions}</span>
              <span className="text-white/30">Accounts</span>
              <span className="text-white/60 text-right">{data.dbStats.totalAccounts}</span>
              <span className="text-white/30">Contacts</span>
              <span className="text-white/60 text-right">{data.dbStats.totalContacts}</span>
              <span className="text-white/30">Invoices</span>
              <span className="text-white/60 text-right">{data.dbStats.totalInvoices}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation Status */}
      <ReconciliationCard />

      {/* Recent Transactions */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white/60">Recent Transactions</h2>
          <Link href="/account/transactions" className="text-xs text-cyan-400 hover:text-cyan-300">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Bank</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {data.recentTransactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="hover:bg-white/[0.04]">
                  <td className="px-5 py-3 text-white/60">
                    {new Date(tx.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3 text-white truncate max-w-[300px]">
                    {tx.description}
                  </td>
                  <td className="px-5 py-3 text-white/40 text-xs">
                    {tx.bankAccount?.name || '\u2014'}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono ${
                      tx.type === 'RECEIVE' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {tx.type === 'RECEIVE' ? '+' : '-'}
                    {fmt.format(tx.amount)}
                  </td>
                </tr>
              ))}
              {data.recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-white/30">
                    No transactions yet — click &quot;Sync from Xero&quot; to import
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function buildMonthlyData(transactions: Transaction[]) {
  const months: Record<string, { revenue: number; expenses: number }> = {};
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months[key] = { revenue: 0, expenses: 0 };
  }

  for (const tx of transactions) {
    const d = new Date(tx.date);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (months[key]) {
      if (tx.type === 'RECEIVE') months[key].revenue += tx.amount;
      else months[key].expenses += tx.amount;
    }
  }

  return Object.entries(months).map(([month, vals]) => ({
    month,
    revenue: Math.round(vals.revenue * 100) / 100,
    expenses: Math.round(vals.expenses * 100) / 100,
  }));
}

function ReconciliationCard() {
  const [recon, setRecon] = useState<{ summary: { matched: number; unmatched: number; total: number }; lastRun?: string } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch('/api/account/reconciliation').then(r => r.json()).then(setRecon).catch(() => {});
  }, []);

  async function runReconcile() {
    setRunning(true);
    try {
      const res = await fetch('/api/account/reconciliation', { method: 'POST' });
      const data = await res.json();
      setRecon({ summary: data, lastRun: new Date().toISOString() });
    } catch { /* ignore */ }
    setRunning(false);
  }

  if (!recon || !recon.summary?.total) return null;

  const { matched, unmatched, total } = recon.summary;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/60">Stripe Reconciliation</h2>
        <button
          onClick={runReconcile}
          disabled={running}
          className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-40"
        >
          {running ? 'Running...' : 'Re-run'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-white/40">Match Rate</p>
          <p className={`text-xl font-bold ${pct >= 90 ? 'text-green-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Matched</p>
          <p className="text-xl font-bold text-green-400">{matched}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Unmatched</p>
          <p className={`text-xl font-bold ${unmatched > 0 ? 'text-amber-400' : 'text-white/40'}`}>{unmatched}</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10">
        <div className="bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        {unmatched > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${((unmatched / total) * 100)}%` }} />}
      </div>
      <p className="mt-2 text-[0.65rem] text-white/30">
        {total} Stripe payouts checked against bank deposits
        {recon.lastRun ? ` \u00B7 Last run ${new Date(recon.lastRun).toLocaleString()}` : ''}
      </p>
    </div>
  );
}
