"use client";

import type { WdClientData } from "./wd-client-row";

interface Props {
  clients: WdClientData[];
}

export function WdSummaryPanel({ clients }: Props) {
  const active = clients.filter(c => c.active);
  const inactive = clients.filter(c => !c.active);
  const allPayments = clients.flatMap(c => c.payments);

  const allTimeSpent = clients.reduce((s, c) => s + c.unitCost, 0);
  const allTimeIncome = allPayments.reduce((s, p) => s + p.amount, 0);
  const profit = allTimeIncome - allTimeSpent;
  const avgPrice = clients.length > 0 ? allTimeSpent / clients.length : 0;

  // Monthly income estimate: active clients * their average payment
  const bundleCount = active.filter(c => c.unitDescription.toLowerCase().includes("dryer") || c.unitDescription.toLowerCase().includes("bundle") || c.unitDescription.toLowerCase().includes("w&d") || c.unitDescription.toLowerCase().includes("w/d") || c.unitDescription.toLowerCase().includes("and d")).length;
  const washerOnlyCount = active.length - bundleCount;
  const monthlyIncome = (bundleCount * 55) + (washerOnlyCount * 40);

  // Lost clients
  const lostInvestment = inactive.reduce((s, c) => s + c.unitCost, 0);
  const lostRecovered = inactive.reduce((s, c) => s + c.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const netLoss = lostInvestment - lostRecovered;

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <h4>All Time Spent</h4>
        <div className="val">${allTimeSpent.toLocaleString()}</div>
      </div>
      <div className="summary-card">
        <h4>All Time Income</h4>
        <div className="val">${allTimeIncome.toLocaleString()}</div>
      </div>
      <div className="summary-card">
        <h4>Profit</h4>
        <div className="val" style={{ color: profit >= 0 ? "#006100" : "#9c0006" }}>${profit.toLocaleString()}</div>
      </div>
      <div className="summary-card">
        <h4>Average Price per Unit</h4>
        <div className="val">${avgPrice.toFixed(0)}</div>
      </div>
      <div className="summary-card">
        <h4>Monthly Income (est.)</h4>
        <div className="val">${monthlyIncome.toLocaleString()}/mo</div>
        <div style={{ fontSize: 10, color: "#666" }}>
          {active.length} active ({bundleCount} bundle, {washerOnlyCount} washer-only)
        </div>
      </div>
      <div className="summary-card">
        <h4>Total Clients</h4>
        <div className="val">{clients.length} ({active.length} active)</div>
      </div>
      <div className="summary-card">
        <h4>Lost Clients</h4>
        <div className="val" style={{ color: "#9c0006" }}>{inactive.length}</div>
        <div style={{ fontSize: 10, color: "#666" }}>
          Invested: ${lostInvestment} | Recovered: ${lostRecovered} | Net: ${netLoss >= 0 ? "-" : ""}${Math.abs(netLoss)}
        </div>
      </div>
    </div>
  );
}
