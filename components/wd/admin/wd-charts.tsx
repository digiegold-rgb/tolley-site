"use client";

import type { RepairItem } from "./wd-repairs-table";
import type { WdClientData } from "./wd-client-row";

interface Props {
  clients: WdClientData[];
  repairItems: RepairItem[];
}

// Simple CSS pie chart via conic-gradient
function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return <div style={{ color: "#999" }}>No data</div>;

  let cumPct = 0;
  const stops: string[] = [];
  slices.forEach(sl => {
    const pct = (sl.value / total) * 100;
    stops.push(`${sl.color} ${cumPct}% ${cumPct + pct}%`);
    cumPct += pct;
  });

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: `conic-gradient(${stops.join(", ")})`,
        flexShrink: 0,
      }} />
      <div style={{ fontSize: 10 }}>
        {slices.map((sl, i) => (
          <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, background: sl.color, borderRadius: 2, display: "inline-block" }} />
            <span>{sl.label}: ${sl.value}</span>
          </div>
        ))}
        <div style={{ fontWeight: 600, marginTop: 4 }}>Total: ${total}</div>
      </div>
    </div>
  );
}

// Simple bar chart using divs
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value));

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 20 }}>
          <div style={{ fontSize: 9, marginBottom: 2 }}>${d.value}</div>
          <div style={{
            width: "100%",
            maxWidth: 28,
            height: `${(d.value / max) * 100}px`,
            background: "linear-gradient(180deg, #5b9bd5, #4472c4)",
            borderRadius: "6px 6px 0 0",
            minHeight: 2,
          }} />
          <div style={{ fontSize: 8, marginTop: 2, transform: "rotate(-45deg)", transformOrigin: "top left", whiteSpace: "nowrap" }}>
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WdCharts({ clients, repairItems }: Props) {
  // Money Out pie: group repair items by name, top items
  const COLORS = [
    "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5",
    "#70ad47", "#264478", "#9b59b6", "#e74c3c", "#1abc9c",
    "#f39c12", "#8e44ad", "#2ecc71", "#e67e22", "#3498db",
  ];

  const pieSlices = repairItems.map((item, i) => ({
    label: item.name,
    value: item.cost,
    color: COLORS[i % COLORS.length],
  }));

  // Revenue over time: aggregate payments by month
  const monthTotals: Record<string, number> = {};
  clients.forEach(c => {
    c.payments.forEach(p => {
      monthTotals[p.month] = (monthTotals[p.month] || 0) + p.amount;
    });
  });
  const sortedMonths = Object.keys(monthTotals).sort();
  const revenueData = sortedMonths.map(m => {
    const [y, mo] = m.split("-");
    return { label: `${parseInt(mo)}/${y.slice(2)}`, value: monthTotals[m] };
  });

  return (
    <div className="chart-container">
      <div className="chart-box">
        <h4 style={{ margin: "0 0 8px", fontSize: 12 }}>Money Out (Items &amp; Repairs)</h4>
        <PieChart slices={pieSlices} />
      </div>
      <div className="chart-box">
        <h4 style={{ margin: "0 0 8px", fontSize: 12 }}>Revenue Over Time</h4>
        {revenueData.length > 0 ? (
          <BarChart data={revenueData} />
        ) : (
          <div style={{ color: "#999" }}>No payment data</div>
        )}
      </div>
    </div>
  );
}
