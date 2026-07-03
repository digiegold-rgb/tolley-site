"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/budget/format";

type Category = { id: string; name: string; slug: string; color: string };
type SeriesRow = { month: string; total: number; [slug: string]: string | number };

export function TrendsClient() {
  const [months, setMonths] = useState(6);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/vater/budget/trends?months=${months}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (cancelled) return;
        setSeries(j.series);
        setCategories(j.categories);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [months]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400">Range:</span>
        {[3, 6, 12].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonths(m)}
            className={`rounded-full border px-3 py-1 font-semibold transition ${
              months === m
                ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
                : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}
          >
            {m}m
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="vater-card p-4">
        {loading ? (
          <div className="flex h-72 items-center justify-center text-sm text-slate-400">Loading…</div>
        ) : series.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-slate-400">No data.</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [formatMoney(Number(value) || 0), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {categories.map((c) => (
                  <Bar
                    key={c.slug}
                    dataKey={c.slug}
                    name={c.name}
                    stackId="spent"
                    fill={c.color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
