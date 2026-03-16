"use client";

import { WdClientRow, type WdClientData } from "./wd-client-row";

interface Props {
  label: string;
  clients: WdClientData[];
  role: "tolley";
  showSplit: boolean;
  maxPayments: number;
  onPaymentStatus: (paymentId: string, status: string) => void;
  onConfirmToggle: (clientId: string, val: boolean) => void;
  onSave: (clientId: string, fields: Record<string, string | number>) => void;
}

const BASE_COLS = [
  "", "Unit Type", "Investment", "Install Date", "Profit",
  "Client Name", "Total Paid", "\u2713", "Address", "Notes",
  "Phone", "Email",
];

const WEEK_LABELS: Record<string, string> = {
  "Install Day 1-7": "Week 1 \u2014 1st through 7th",
  "Install Day 8-14": "Week 2 \u2014 8th through 14th",
  "Install Day 15-21": "Week 3 \u2014 15th through 21st",
  "Install Day 22-31": "Week 4 \u2014 22nd through 31st",
};

function getDisplayLabel(label: string): string {
  return WEEK_LABELS[label] ?? label;
}

export function WdDateBlock({ label, clients, role, showSplit, maxPayments, onPaymentStatus, onConfirmToggle, onSave }: Props) {
  if (clients.length === 0) return null;

  const cols = [...BASE_COLS];
  if (showSplit) {
    cols.push("Tolley $");
  }
  cols.push("# Pay");

  // Payment month headers
  const allMonths = new Set<string>();
  clients.forEach(c => c.payments.forEach(p => allMonths.add(p.month)));
  const sortedMonths = [...allMonths].sort();
  sortedMonths.forEach(m => {
    const [y, mo] = m.split("-");
    cols.push(`${parseInt(mo)}/${y.slice(2)}`);
  });
  // Pad to maxPayments
  for (let i = sortedMonths.length; i < maxPayments; i++) {
    cols.push(`Pay ${i + 1}`);
  }

  const totalInvestment = clients.reduce((s, c) => s + c.unitCost, 0);
  const totalPaid = clients.reduce((s, c) => s + c.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalProfit = totalPaid - totalInvestment;

  const displayLabel = getDisplayLabel(label);

  return (
    <div className="date-block-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr className="section-header">
              <td colSpan={cols.length}>{displayLabel} ({clients.length} clients)</td>
            </tr>
            <tr>
              {cols.map((c, i) => {
                const stickyClass = i < 5 ? `sticky-col-${i}` : "";
                return <th key={i} className={stickyClass}>{c}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <WdClientRow
                key={c.id}
                client={c}
                role={role}
                showSplit={showSplit}
                maxPayments={maxPayments}
                onPaymentStatus={onPaymentStatus}
                onConfirmToggle={onConfirmToggle}
                onSave={onSave}
              />
            ))}
            <tr className="subtotal-row">
              <td className="sticky-col-0" />
              <td className="sticky-col-1">{clients.length} units</td>
              <td className="sticky-col-2" style={{ textAlign: "right" }}>${totalInvestment.toFixed(0)}</td>
              <td className="sticky-col-3" />
              <td className="sticky-col-4" style={{ textAlign: "right", color: totalProfit >= 0 ? "#006100" : "#9c0006" }}>${totalProfit.toFixed(0)}</td>
              <td />
              <td style={{ textAlign: "right" }}>${totalPaid.toFixed(0)}</td>
              <td colSpan={cols.length - 7} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
