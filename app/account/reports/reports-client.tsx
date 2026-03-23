'use client';

import { useEffect, useState, useCallback } from 'react';
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

interface PLEntry {
  code: string;
  name: string;
  total: number;
}

interface PLComparison {
  code: string;
  name: string;
  total: number;
  priorTotal: number;
  change: number;
}

interface PLData {
  revenue: PLEntry[];
  expenses: PLEntry[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  comparison?: {
    revenue: PLComparison[];
    expenses: PLComparison[];
    priorTotalRevenue: number;
    priorTotalExpenses: number;
    priorNetIncome: number;
    revenueChange: number;
    expenseChange: number;
    netIncomeChange: number;
  };
}

interface BankBalance {
  accountId: string | null;
  code: string | null;
  name: string;
  balance: number;
}

interface BalanceData {
  assets: {
    bankBalances: BankBalance[];
    accountsReceivable: number;
    totalAssets: number;
  };
  equity: { code: string | null; name: string | null; balance: number }[];
}

function ChangeIndicator({ current, prior }: { current: number; prior: number }) {
  if (prior === 0 && current === 0) return null;
  if (prior === 0) return <span className="text-white/20 text-xs">new</span>;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const isUp = pct >= 0;
  return (
    <span className={`text-xs font-medium ${isUp ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
      {isUp ? '+' : ''}{pct.toFixed(0)}%
    </span>
  );
}

export default function ReportsClient() {
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [compareMode, setCompareMode] = useState<string>('prior-year');
  const [plData, setPlData] = useState<PLData | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (compareMode) params.set('compare', compareMode);

      const [plRes, balRes] = await Promise.all([
        fetch(`/api/account/reports/pl?${params}`),
        fetch('/api/account/reports/balance'),
      ]);

      if (!plRes.ok) throw new Error('Failed to load P&L');
      if (!balRes.ok) throw new Error('Failed to load balance sheet');

      setPlData(await plRes.json());
      setBalanceData(await balRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading reports');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, compareMode]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const hasComparison = !!plData?.comparison;

  const chartData = plData
    ? hasComparison
      ? [
          {
            name: 'Revenue',
            current: plData.totalRevenue,
            prior: plData.comparison!.priorTotalRevenue,
          },
          {
            name: 'Expenses',
            current: plData.totalExpenses,
            prior: plData.comparison!.priorTotalExpenses,
          },
          {
            name: 'Net Income',
            current: plData.netIncome,
            prior: plData.comparison!.priorNetIncome,
          },
        ]
      : [
          { name: 'Revenue', current: plData.totalRevenue },
          { name: 'Expenses', current: plData.totalExpenses },
          { name: 'Net Income', current: plData.netIncome },
        ]
    : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-white/40 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {[
            {
              label: 'YTD',
              fn: () => {
                setDateFrom(`${currentYear}-01-01`);
                setDateTo(new Date().toISOString().split('T')[0]);
              },
            },
            {
              label: 'MTD',
              fn: () => {
                const now = new Date();
                setDateFrom(
                  new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
                );
                setDateTo(now.toISOString().split('T')[0]);
              },
            },
            {
              label: 'QTD',
              fn: () => {
                const now = new Date();
                const q = Math.floor(now.getMonth() / 3);
                setDateFrom(
                  new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0],
                );
                setDateTo(now.toISOString().split('T')[0]);
              },
            },
            {
              label: `${currentYear - 1}`,
              fn: () => {
                setDateFrom(`${currentYear - 1}-01-01`);
                setDateTo(`${currentYear - 1}-12-31`);
              },
            },
            {
              label: 'Full Year',
              fn: () => {
                setDateFrom(`${currentYear}-01-01`);
                setDateTo(`${currentYear}-12-31`);
              },
            },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.fn}
              className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Compare</label>
          <select
            value={compareMode}
            onChange={(e) => setCompareMode(e.target.value)}
            className="bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-1.5 text-sm"
          >
            <option value="">None</option>
            <option value="prior-year">Prior Year</option>
            <option value="prior-period">Prior Period</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary Chart */}
          {plData && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5">
              <h2 className="text-sm font-semibold text-white/60 mb-4">
                Summary {hasComparison && '(Current vs Prior)'}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    type="number"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={12}
                    tickFormatter={(v) => `$${v.toLocaleString()}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={12}
                    width={100}
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
                  {hasComparison && <Legend />}
                  <Bar
                    dataKey="current"
                    name="Current Period"
                    fill="#06b6d4"
                    radius={[0, 4, 4, 0]}
                  />
                  {hasComparison && (
                    <Bar
                      dataKey="prior"
                      name="Prior Period"
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                      opacity={0.6}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* P&L Report */}
          {plData && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm overflow-hidden">
              <div className="p-5 border-b border-white/[0.08]">
                <h2 className="text-lg font-semibold text-white">Profit & Loss</h2>
                <p className="text-xs text-white/40 mt-1">
                  {dateFrom} to {dateTo}
                  {hasComparison && ' (with comparison)'}
                </p>
              </div>

              {/* Revenue */}
              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                    Revenue
                  </h3>
                  {hasComparison && (
                    <div className="text-xs text-white/30 flex gap-6">
                      <span>Current</span>
                      <span>Prior</span>
                      <span>Change</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {(hasComparison ? plData.comparison!.revenue : plData.revenue).map((entry) => {
                    const isComparison = 'priorTotal' in entry;
                    return (
                      <div key={entry.code} className="flex justify-between py-1.5 text-sm">
                        <span className="text-white/80 flex-1">
                          <span className="text-white/30 font-mono text-xs mr-2">
                            {entry.code}
                          </span>
                          {entry.name}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-white font-mono w-24 text-right">
                            {fmt.format(entry.total)}
                          </span>
                          {isComparison && (
                            <>
                              <span className="text-white/40 font-mono w-24 text-right">
                                {fmt.format((entry as PLComparison).priorTotal)}
                              </span>
                              <span className="w-12 text-right">
                                <ChangeIndicator
                                  current={entry.total}
                                  prior={(entry as PLComparison).priorTotal}
                                />
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {plData.revenue.length === 0 && (
                    <p className="text-white/30 text-sm">No revenue entries</p>
                  )}
                </div>
                <div className="flex justify-between pt-3 mt-3 border-t border-white/[0.08] text-sm font-semibold">
                  <span className="text-white/60">Total Revenue</span>
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-400 font-mono w-24 text-right">
                      {fmt.format(plData.totalRevenue)}
                    </span>
                    {hasComparison && (
                      <>
                        <span className="text-emerald-400/50 font-mono w-24 text-right">
                          {fmt.format(plData.comparison!.priorTotalRevenue)}
                        </span>
                        <span className="w-12 text-right">
                          <ChangeIndicator
                            current={plData.totalRevenue}
                            prior={plData.comparison!.priorTotalRevenue}
                          />
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div className="p-5 border-t border-white/[0.08]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                    Expenses
                  </h3>
                  {hasComparison && (
                    <div className="text-xs text-white/30 flex gap-6">
                      <span>Current</span>
                      <span>Prior</span>
                      <span>Change</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {(hasComparison ? plData.comparison!.expenses : plData.expenses).map((entry) => {
                    const isComparison = 'priorTotal' in entry;
                    return (
                      <div key={entry.code} className="flex justify-between py-1.5 text-sm">
                        <span className="text-white/80 flex-1">
                          <span className="text-white/30 font-mono text-xs mr-2">
                            {entry.code}
                          </span>
                          {entry.name}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-white font-mono w-24 text-right">
                            {fmt.format(entry.total)}
                          </span>
                          {isComparison && (
                            <>
                              <span className="text-white/40 font-mono w-24 text-right">
                                {fmt.format((entry as PLComparison).priorTotal)}
                              </span>
                              <span className="w-12 text-right">
                                <ChangeIndicator
                                  current={entry.total}
                                  prior={(entry as PLComparison).priorTotal}
                                />
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {plData.expenses.length === 0 && (
                    <p className="text-white/30 text-sm">No expense entries</p>
                  )}
                </div>
                <div className="flex justify-between pt-3 mt-3 border-t border-white/[0.08] text-sm font-semibold">
                  <span className="text-white/60">Total Expenses</span>
                  <div className="flex items-center gap-4">
                    <span className="text-red-400 font-mono w-24 text-right">
                      {fmt.format(plData.totalExpenses)}
                    </span>
                    {hasComparison && (
                      <>
                        <span className="text-red-400/50 font-mono w-24 text-right">
                          {fmt.format(plData.comparison!.priorTotalExpenses)}
                        </span>
                        <span className="w-12 text-right">
                          <ChangeIndicator
                            current={plData.totalExpenses}
                            prior={plData.comparison!.priorTotalExpenses}
                          />
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Net Income */}
              <div className="p-5 border-t-2 border-cyan-400/30 bg-white/[0.02]">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-white">Net Income</span>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-mono ${
                        plData.netIncome >= 0 ? 'text-cyan-400' : 'text-red-400'
                      }`}
                    >
                      {fmt.format(plData.netIncome)}
                    </span>
                    {hasComparison && (
                      <>
                        <span
                          className={`font-mono text-base opacity-50 w-24 text-right ${
                            plData.comparison!.priorNetIncome >= 0
                              ? 'text-cyan-400'
                              : 'text-red-400'
                          }`}
                        >
                          {fmt.format(plData.comparison!.priorNetIncome)}
                        </span>
                        <span className="w-12 text-right">
                          <ChangeIndicator
                            current={plData.netIncome}
                            prior={plData.comparison!.priorNetIncome}
                          />
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {balanceData && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm overflow-hidden">
              <div className="p-5 border-b border-white/[0.08]">
                <h2 className="text-lg font-semibold text-white">Balance Sheet</h2>
              </div>

              {/* Assets */}
              <div className="p-5">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">
                  Assets
                </h3>

                <div className="space-y-1">
                  {balanceData.assets.bankBalances.map((bank) => (
                    <div
                      key={bank.accountId || bank.name}
                      className="flex justify-between py-1.5 text-sm"
                    >
                      <span className="text-white/80">
                        {bank.code && (
                          <span className="text-white/30 font-mono text-xs mr-2">{bank.code}</span>
                        )}
                        {bank.name}
                      </span>
                      <span className="text-white font-mono">{fmt.format(bank.balance)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between py-1.5 text-sm mt-2">
                  <span className="text-white/80">Accounts Receivable</span>
                  <span className="text-white font-mono">
                    {fmt.format(balanceData.assets.accountsReceivable)}
                  </span>
                </div>

                <div className="flex justify-between pt-3 mt-3 border-t border-white/[0.08] text-sm font-semibold">
                  <span className="text-white/60">Total Assets</span>
                  <span className="text-cyan-400 font-mono">
                    {fmt.format(balanceData.assets.totalAssets)}
                  </span>
                </div>
              </div>

              {/* Equity */}
              {balanceData.equity.length > 0 && (
                <div className="p-5 border-t border-white/[0.08]">
                  <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">
                    Equity
                  </h3>
                  <div className="space-y-1">
                    {balanceData.equity.map((eq, i) => (
                      <div key={i} className="flex justify-between py-1.5 text-sm">
                        <span className="text-white/80">
                          {eq.code && (
                            <span className="text-white/30 font-mono text-xs mr-2">{eq.code}</span>
                          )}
                          {eq.name || 'Unknown'}
                        </span>
                        <span className="text-white font-mono">{fmt.format(eq.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
