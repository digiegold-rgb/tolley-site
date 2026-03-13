"use client";

import { useState } from "react";
import { WdPaymentCell } from "./wd-payment-cell";

interface WdPayment {
  id: string;
  amount: number;
  month: string;
  status: string;
  note: string | null;
}

interface RevenueSplit {
  totalRevenue: number;
  tolleySplit: number;
  keeganSplit: number;
  paybackComplete: boolean;
  paybackRemaining: number;
}

export interface WdClientData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  unitDescription: string;
  unitCost: number;
  installDate: string | null;
  active: boolean;
  confirmed: boolean;
  notes: string | null;
  source: string;
  paidBy: string;
  payments: WdPayment[];
  split: RevenueSplit;
}

interface Props {
  client: WdClientData;
  role: "tolley" | "keegan";
  showSplit: boolean;
  maxPayments: number;
  onPaymentStatus: (paymentId: string, status: string) => void;
  onConfirmToggle: (clientId: string, val: boolean) => void;
  onSave: (clientId: string, fields: Record<string, string | number>) => void;
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

export function WdClientRow({ client, role, showSplit, maxPayments, onPaymentStatus, onConfirmToggle, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    unitDescription: client.unitDescription,
    unitCost: String(client.unitCost),
    name: client.name,
    address: client.address || "",
    notes: client.notes || "",
    phone: client.phone || "",
    email: client.email || "",
  });

  const totalPaid = client.payments.reduce((s, p) => s + p.amount, 0);
  const profit = totalPaid - client.unitCost;
  const sorted = [...client.payments].sort((a, b) => a.month.localeCompare(b.month));

  function handleSave() {
    onSave(client.id, {
      unitDescription: fields.unitDescription,
      unitCost: parseFloat(fields.unitCost) || client.unitCost,
      name: fields.name,
      address: fields.address,
      notes: fields.notes,
      phone: fields.phone,
      email: fields.email,
    });
    setEditing(false);
  }

  function handleCancel() {
    setFields({
      unitDescription: client.unitDescription,
      unitCost: String(client.unitCost),
      name: client.name,
      address: client.address || "",
      notes: client.notes || "",
      phone: client.phone || "",
      email: client.email || "",
    });
    setEditing(false);
  }

  const rowClass = !client.active ? "inactive-row" : "";

  if (editing && role === "tolley") {
    return (
      <tr className={rowClass}>
        <td className="sticky-col-0">
          <button className="edit-btn" onClick={handleSave} title="Save">&#10003;</button>
          <button className="edit-btn" onClick={handleCancel} title="Cancel">&#10007;</button>
        </td>
        <td className="sticky-col-1"><input className="edit-input" value={fields.unitDescription} onChange={e => setFields(f => ({ ...f, unitDescription: e.target.value }))} /></td>
        <td className="sticky-col-2"><input className="edit-input" type="number" value={fields.unitCost} onChange={e => setFields(f => ({ ...f, unitCost: e.target.value }))} /></td>
        <td className="sticky-col-3">{fmtDate(client.installDate)}</td>
        <td className="sticky-col-4" style={{ textAlign: "right", color: profit >= 0 ? "#006100" : "#9c0006" }}>${profit.toFixed(0)}</td>
        <td><input className="edit-input" value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} /></td>
        <td style={{ textAlign: "right" }}>${totalPaid.toFixed(0)}</td>
        <td style={{ textAlign: "center" }}>
          <input type="checkbox" className="confirm-check" checked={client.confirmed} onChange={e => onConfirmToggle(client.id, e.target.checked)} />
        </td>
        <td><input className="edit-input" value={fields.address} onChange={e => setFields(f => ({ ...f, address: e.target.value }))} /></td>
        <td><input className="edit-input" value={fields.notes} onChange={e => setFields(f => ({ ...f, notes: e.target.value }))} /></td>
        <td><input className="edit-input" value={fields.phone} onChange={e => setFields(f => ({ ...f, phone: e.target.value }))} /></td>
        <td><input className="edit-input" value={fields.email} onChange={e => setFields(f => ({ ...f, email: e.target.value }))} /></td>
        {showSplit && (
          <>
            <td style={{ textAlign: "right" }}>${client.split.tolleySplit.toFixed(0)}</td>
            <td style={{ textAlign: "right" }}>${client.split.keeganSplit.toFixed(0)}</td>
          </>
        )}
        <td style={{ textAlign: "center" }}>{client.payments.length}</td>
        {sorted.map(p => (
          <WdPaymentCell key={p.id} paymentId={p.id} amount={p.amount} status={p.status} onStatusChange={onPaymentStatus} />
        ))}
        {Array.from({ length: maxPayments - sorted.length }).map((_, i) => (
          <td key={`empty-${i}`} />
        ))}
      </tr>
    );
  }

  return (
    <tr className={rowClass}>
      <td className="sticky-col-0">
        {role === "tolley" && (
          <button className="edit-btn" onClick={() => setEditing(true)} title="Edit row">&#9998;</button>
        )}
      </td>
      <td className="sticky-col-1">{client.unitDescription}</td>
      <td className="sticky-col-2" style={{ textAlign: "right" }}>${client.unitCost.toFixed(0)}</td>
      <td className="sticky-col-3">{fmtDate(client.installDate)}</td>
      <td className="sticky-col-4" style={{ textAlign: "right", color: profit >= 0 ? "#006100" : "#9c0006", fontWeight: 600 }}>${profit.toFixed(0)}</td>
      <td>{client.name}</td>
      <td style={{ textAlign: "right" }}>${totalPaid.toFixed(0)}</td>
      <td style={{ textAlign: "center" }}>
        <input type="checkbox" className="confirm-check" checked={client.confirmed} onChange={e => onConfirmToggle(client.id, e.target.checked)} />
      </td>
      <td title={client.address || ""}>{client.address || ""}</td>
      <td title={client.notes || ""}>{client.notes || ""}</td>
      <td>{client.phone || ""}</td>
      <td>{client.email || ""}</td>
      {showSplit && (
        <>
          <td style={{ textAlign: "right" }}>${client.split.tolleySplit.toFixed(0)}</td>
          <td style={{ textAlign: "right" }}>${client.split.keeganSplit.toFixed(0)}</td>
        </>
      )}
      <td style={{ textAlign: "center" }}>{client.payments.length}</td>
      {sorted.map(p => (
        <WdPaymentCell key={p.id} paymentId={p.id} amount={p.amount} status={p.status} onStatusChange={onPaymentStatus} />
      ))}
      {Array.from({ length: maxPayments - sorted.length }).map((_, i) => (
        <td key={`empty-${i}`} />
      ))}
    </tr>
  );
}
