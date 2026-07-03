'use client';

import { useCallback, useEffect, useState } from 'react';

type CategorySummary = {
  category: string;
  rate: number;
  miles: number;
  deduction: number;
  count: number;
  deductible: boolean;
};

type Summary = {
  categories: CategorySummary[];
  businessMiles: number;
  businessDeduction: number;
  deductibleMiles: number;
  totalDeduction: number;
  personalMiles: number;
  totalMiles: number;
  totalTrips: number;
  totalParking: number;
  totalTolls: number;
};

type Trip = {
  id: string;
  startDate: string;
  endDate: string;
  category: string;
  purpose: string | null;
  startAddr: string;
  stopAddr: string;
  rate: number;
  miles: number;
  milesValue: number;
  total: number;
  notes: string | null;
};

type ApiData = { year: number | null; years: number[]; summary: Summary; trips: Trip[] };

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const mi = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

const CAT_COLOR: Record<string, string> = {
  Business: 'text-emerald-400',
  Medical: 'text-sky-400',
  Moving: 'text-sky-400',
  Charity: 'text-amber-400',
  Personal: 'text-white/40',
  Commute: 'text-white/40',
};

export default function MileageTracker() {
  const [data, setData] = useState<ApiData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/account/mileage?year=${y}`);
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  async function runImport() {
    if (!importText.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/account/mileage/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: importText }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || 'Import failed');
      } else {
        setMsg(
          `Imported ${d.inserted} new trip${d.inserted === 1 ? '' : 's'} (${d.duplicates} dupes, ${d.skipped} skipped).`
        );
        setImportText('');
        setShowImport(false);
        await load(year);
      }
    } catch {
      setMsg('Import failed');
    } finally {
      setBusy(false);
    }
  }

  const s = data?.summary;
  const yearOptions = Array.from(
    new Set([...(data?.years || []), new Date().getFullYear(), year])
  ).sort((a, b) => b - a);

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-white/[0.08] flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🚗</span>
          <h2 className="text-sm font-semibold text-white/60">Mileage Tracker</h2>
          <span className="text-[0.65rem] text-white/30 hidden sm:inline">
            IRS standard-mileage deduction
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {yearOptions.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  year === y ? 'bg-cyan-600 text-white' : 'text-white/50 hover:text-white/70'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowImport((v) => !v)}
            className="rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
          >
            Import
          </button>
          <a
            href={`/api/account/mileage/export?year=${year}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              data?.trips.length
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-white/5 text-white/30 pointer-events-none'
            }`}
          >
            ⬇ Download IRS CSV
          </a>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="p-5 border-b border-white/[0.08] space-y-2">
          <p className="text-xs text-white/40">
            Paste a MileIQ "Detailed Log" export below (the whole report is fine — header rows are
            ignored). Trips dedupe automatically, so re-pasting is safe.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            placeholder="01/01/2026 10:30	01/01/2026 11:58	Business	123 A St…	456 B St…	0.725	95.2	69.02	…"
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-cyan-500/50"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={runImport}
              disabled={busy || !importText.trim()}
              className="rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
            >
              {busy ? 'Importing…' : 'Import trips'}
            </button>
            {msg && <span className="text-xs text-white/50">{msg}</span>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      ) : !s || s.totalTrips === 0 ? (
        <div className="px-5 py-10 text-center text-white/30 text-sm">
          No trips for {year}. Click <span className="text-white/60">Import</span> to load a MileIQ log.
          {msg && <p className="mt-2 text-white/50">{msg}</p>}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            <Stat
              label="Business Miles"
              value={mi(s.businessMiles)}
              sub={`${s.categories.find((c) => c.category === 'Business')?.count || 0} trips`}
              accent="text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
            />
            <Stat
              label="Business Deduction"
              value={usd.format(s.businessDeduction)}
              sub="Schedule C / Form 4562"
              accent="text-cyan-400 border-cyan-500/20 bg-cyan-500/5"
            />
            <Stat
              label="Total Deduction"
              value={usd.format(s.totalDeduction)}
              sub={`${mi(s.deductibleMiles)} deductible mi`}
              accent="text-violet-400 border-violet-500/20 bg-violet-500/5"
            />
            <Stat
              label="Total / Personal"
              value={mi(s.totalMiles)}
              sub={`${mi(s.personalMiles)} mi personal · ${s.totalTrips} trips`}
              accent="text-white/70 border-white/10 bg-white/[0.03]"
            />
          </div>

          {/* Category breakdown */}
          <div className="px-5 pb-5">
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/40 uppercase tracking-wider bg-white/[0.02]">
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Rate</th>
                    <th className="px-4 py-2.5 text-right">Miles</th>
                    <th className="px-4 py-2.5 text-right">Trips</th>
                    <th className="px-4 py-2.5 text-right">Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {s.categories.map((c) => (
                    <tr key={c.category} className="hover:bg-white/[0.03]">
                      <td className={`px-4 py-2.5 font-medium ${CAT_COLOR[c.category] || 'text-white/80'}`}>
                        {c.category}
                        {!c.deductible && (
                          <span className="ml-2 text-[0.6rem] text-white/30 uppercase">non-deductible</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white/40 font-mono text-xs">
                        {c.deductible ? `$${c.rate.toFixed(3)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white/70 font-mono">{mi(c.miles)}</td>
                      <td className="px-4 py-2.5 text-right text-white/40">{c.count}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${c.deductible ? 'text-emerald-400' : 'text-white/30'}`}>
                        {c.deductible ? usd.format(c.deduction) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setShowLog((v) => !v)}
              className="mt-3 text-xs text-cyan-400 hover:text-cyan-300"
            >
              {showLog ? 'Hide' : 'Show'} IRS-compliant trip log ({s.totalTrips} trips) ▾
            </button>
          </div>

          {/* Detailed IRS log */}
          {showLog && (
            <div className="px-5 pb-5">
              <div className="rounded-lg border border-white/10 overflow-x-auto max-h-[28rem] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0c0a14]">
                    <tr className="text-left text-white/40 uppercase tracking-wider">
                      <th className="px-3 py-2 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2">Start</th>
                      <th className="px-3 py-2">Stop</th>
                      <th className="px-3 py-2">Cat</th>
                      <th className="px-3 py-2 text-right">Miles</th>
                      <th className="px-3 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {data!.trips.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.03] align-top">
                        <td className="px-3 py-2 text-white/50 whitespace-nowrap">
                          {new Date(t.startDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          <span className="text-white/25">
                            {' '}
                            {new Date(t.startDate).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-white/70 max-w-[220px]">{t.startAddr}</td>
                        <td className="px-3 py-2 text-white/70 max-w-[220px]">{t.stopAddr}</td>
                        <td className={`px-3 py-2 ${CAT_COLOR[t.category] || 'text-white/60'}`}>
                          {t.category}
                        </td>
                        <td className="px-3 py-2 text-right text-white/70 font-mono">{mi(t.miles)}</td>
                        <td className="px-3 py-2 text-right text-white/50 font-mono">
                          {t.milesValue ? usd.format(t.milesValue) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="px-5 pb-4 text-[0.7rem] text-white/25">
            Home base: 11913 Mar Bec Trail. Standard-mileage rates applied per category. Delivery
            days (Buckeye + Wayne/Aramsco) now auto-log as full round-trips nightly — MileIQ no
            longer required.
            Imported MileIQ history is preserved; new days gap-fill so miles are never
            double-counted. Keep this log — the IRS requires date, start/stop, purpose & miles per
            drive. Consult your CPA before filing.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <p className="text-[0.65rem] text-white/40 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[0.65rem] text-white/30">{sub}</p>
    </div>
  );
}
