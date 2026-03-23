'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type IncomeSource = { source: string; total: number; count: number; mtd: number; wtd: number };
type MonthlyTrend = { month: string; total: number };
type IncomeData = {
  sources: IncomeSource[];
  totalIncome: number;
  totalMTD: number;
  totalWTD: number;
  monthlyTrend: MonthlyTrend[];
  transactionCount: number;
};

const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#a855f7'];

export default function IncomeClient() {
  const [data, setData] = useState<IncomeData | null>(null);
  const [period, setPeriod] = useState('ytd');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/account/income?period=${period}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="text-center py-12 text-white/40">Loading...</div>;
  if (!data) return <div className="text-center py-12 text-white/40">No data</div>;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white/95">Income by Source</h2>
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {['wtd', 'mtd', 'ytd'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${period === p ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40 uppercase">YTD Income</p>
          <p className="mt-1 text-2xl font-bold text-green-400">${data.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40 uppercase">This Month</p>
          <p className="mt-1 text-2xl font-bold text-white/90">${data.totalMTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40 uppercase">This Week</p>
          <p className="mt-1 text-2xl font-bold text-white/90">${data.totalWTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 text-sm font-medium text-white/50">Monthly Income Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.monthlyTrend}>
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              itemStyle={{ color: '#4ade80' }}
              formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Income']}
            />
            <Bar dataKey="total" fill="#4ade80" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Income sources table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase">
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">MTD</th>
              <th className="px-4 py-3 text-right">WTD</th>
              <th className="px-4 py-3 text-right">Txns</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s, i) => (
              <tr key={s.source} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-white/90">{s.source}</span>
                </td>
                <td className="px-4 py-3 text-right text-green-400 font-medium">${s.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-white/60">${s.mtd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-white/60">${s.wtd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-white/40">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Source breakdown donut-style bar */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-medium text-white/50">Income Distribution</h3>
        <div className="flex h-4 overflow-hidden rounded-full">
          {data.sources.map((s, i) => (
            <div
              key={s.source}
              title={`${s.source}: $${s.total.toFixed(2)} (${((s.total / data.totalIncome) * 100).toFixed(1)}%)`}
              style={{ width: `${(s.total / data.totalIncome) * 100}%`, background: COLORS[i % COLORS.length] }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {data.sources.map((s, i) => (
            <span key={s.source} className="flex items-center gap-1.5 text-xs text-white/50">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {s.source} ({((s.total / data.totalIncome) * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
