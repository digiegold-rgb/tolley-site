"use client";

import { WdClientRow, type WdClientData } from "./wd-client-row";

interface Props {
  label: string;
  clients: WdClientData[];
  role: "tolley" | "keegan";
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

export function WdDateBlock({ label, clients, role, showSplit, maxPayments, onPaymentStatus, onConfirmToggle, onSave }: Props) {
  if (clients.length === 0) return null;

  const cols = [...BASE_COLS];
  if (showSplit) {
    cols.push("Tolley $", "Keagan $");
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

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr className="section-header">
            <td colSpan={cols.length}>{label} ({clients.length} clients)</td>
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
  );
}
