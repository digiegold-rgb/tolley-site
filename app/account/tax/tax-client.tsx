'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type TaxCategory = { category: string; irsLine: string; total: number; count: number; deductible: boolean };
type TaxSummary = { totalRevenue: number; totalDeductibleExpenses: number; estimatedTaxableIncome: number; totalTransactions: number };
type TaxData = { year: string; categories: TaxCategory[]; summary: TaxSummary };

export default function TaxClient() {
  const [data, setData] = useState<TaxData | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/account/tax-categories?year=${year}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="text-center py-12 text-white/40">Loading...</div>;
  if (!data) return <div className="text-center py-12 text-white/40">No data</div>;

  const deductible = data.categories.filter(c => c.deductible && c.category !== 'Revenue');
  const chartData = deductible.map(c => ({ name: c.category, amount: c.total }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white/95">Tax Categories (1120-S)</h2>
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {['2024', '2025', '2026'].map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${year === y ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Tax summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-xs text-white/40 uppercase">Gross Revenue</p>
          <p className="mt-1 text-2xl font-bold text-green-400">${data.summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-white/30">IRS Line 1a</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-white/40 uppercase">Deductible Expenses</p>
          <p className="mt-1 text-2xl font-bold text-red-400">${data.summary.totalDeductibleExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-white/30">Lines 7-19</p>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-xs text-white/40 uppercase">Est. Taxable Income</p>
          <p className="mt-1 text-2xl font-bold text-violet-400">${data.summary.estimatedTaxableIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-white/30">Line 21</p>
        </div>
      </div>

      {/* Expense breakdown chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-4 text-sm font-medium text-white/50">Deductible Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} axisLine={false} tickLine={false} width={150} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Amount']}
              />
              <Bar dataKey="amount" fill="#f87171" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full category table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">IRS Line</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Txns</th>
              <th className="px-4 py-3 text-center">Deductible</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map(c => (
              <tr key={c.category} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white/90">{c.category}</td>
                <td className="px-4 py-3 text-white/40 font-mono text-xs">{c.irsLine}</td>
                <td className={`px-4 py-3 text-right font-medium ${c.category === 'Revenue' ? 'text-green-400' : c.deductible ? 'text-red-400' : 'text-white/40'}`}>
                  ${Math.abs(c.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-white/40">{c.count}</td>
                <td className="px-4 py-3 text-center">
                  {c.deductible ? (
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[0.65rem] text-green-400">Yes</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-white/30">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/30">
        Tax categories auto-mapped from Plaid transaction data. {data.summary.totalTransactions} transactions analyzed.
        Consult your CPA before filing — this is an estimate based on automated categorization.
      </p>
    </div>
  );
}
