"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { COST_CATEGORIES } from "@/lib/water";

interface CostEntry {
  id: string;
  season: number;
  category: string;
  item: string;
  amount: number;
  quantity: number | null;
  unit: string | null;
  vendor: string | null;
  purchaseDate: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  chemical: "#00e5c7",
  equipment: "#3b82f6",
  repair: "#ef4444",
  startup: "#f59e0b",
  utility: "#a855f7",
};

export function WaterCostTracker() {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [summary, setSummary] = useState<{ bySeason: Record<number, Record<string, number>>; total: number } | null>(null);
  const [season, setSeason] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [fSeason, setFSeason] = useState(String(new Date().getFullYear()));
  const [fCategory, setFCategory] = useState("chemical");
  const [fItem, setFItem] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fQuantity, setFQuantity] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fVendor, setFVendor] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    fetch(`/api/water/costs?season=${season}`)
      .then((r) => r.json())
      .then((d) => setCosts(d.costs || []));
    fetch("/api/water/costs?summary=true")
      .then((r) => r.json())
      .then((d) => setSummary(d));
  }, [season]);

  useEffect(() => { loadData(); }, [loadData]);

  const chartData = summary
    ? Object.entries(summary.bySeason)
        .map(([yr, cats]) => ({
          season: yr,
          ...cats,
          total: Object.values(cats).reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => Number(a.season) - Number(b.season))
    : [];

  const seasonTotal = costs.reduce((s, c) => s + c.amount, 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/water/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        season: Number(fSeason),
        category: fCategory,
        item: fItem,
        amount: Number(fAmount),
        quantity: fQuantity ? Number(fQuantity) : null,
        unit: fUnit || null,
        vendor: fVendor || null,
      }),
    });
    setFItem("");
    setFAmount("");
    setFQuantity("");
    setFUnit("");
    setFVendor("");
    setSaving(false);
    setShowForm(false);
    loadData();
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="water-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Pool Costs</h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#00e5c7]">${summary?.total?.toLocaleString() ?? "—"}</span>
            <span className="text-xs text-white/30">All Time</span>
          </div>
        </div>

        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="season" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  background: "#0d1520",
                  border: "1px solid rgba(0,229,199,0.2)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(v) => [`$${Number(v).toFixed(0)}`, ""]}
              />
              {COST_CATEGORIES.map((cat) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="a"
                  fill={CATEGORY_COLORS[cat] || "#666"}
                  name={cat}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Season Detail */}
      <div className="water-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="water-select">
              {[2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-lg font-bold text-white/70">${seasonTotal.toLocaleString()}</span>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="water-btn water-btn-primary">
            {showForm ? "Cancel" : "+ Add Purchase"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="mb-4 grid gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-4 sm:grid-cols-3">
            <select value={fSeason} onChange={(e) => setFSeason(e.target.value)} className="water-select">
              {[2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="water-select">
              {COST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={fItem} onChange={(e) => setFItem(e.target.value)} placeholder="Item" className="water-input" required />
            <input type="number" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="Amount ($)" className="water-input" required />
            <input type="number" value={fQuantity} onChange={(e) => setFQuantity(e.target.value)} placeholder="Qty" className="water-input" />
            <input value={fUnit} onChange={(e) => setFUnit(e.target.value)} placeholder="Unit" className="water-input" />
            <input value={fVendor} onChange={(e) => setFVendor(e.target.value)} placeholder="Vendor" className="water-input" />
            <button type="submit" disabled={saving} className="water-btn water-btn-primary sm:col-span-2">
              {saving ? "Saving..." : "Add"}
            </button>
          </form>
        )}

        {/* Costs table */}
        <div className="overflow-x-auto">
          <table className="water-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Item</th>
                <th>Amount</th>
                <th>Qty</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: (CATEGORY_COLORS[c.category] || "#666") + "20", color: CATEGORY_COLORS[c.category] || "#999" }}>
                      {c.category}
                    </span>
                  </td>
                  <td>{c.item}</td>
                  <td className="font-mono">${c.amount.toFixed(0)}</td>
                  <td className="text-white/40">{c.quantity ? `${c.quantity} ${c.unit || ""}` : "—"}</td>
                  <td className="text-white/40">{new Date(c.purchaseDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
