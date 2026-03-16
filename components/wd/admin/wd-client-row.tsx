"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  role: "tolley";
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

type EditableField = "name" | "unitDescription" | "unitCost" | "address" | "notes" | "phone" | "email";

export function WdClientRow({ client, role, showSplit, maxPayments, onPaymentStatus, onConfirmToggle, onSave }: Props) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [fields, setFields] = useState({
    unitDescription: client.unitDescription,
    unitCost: String(client.unitCost),
    name: client.name,
    address: client.address || "",
    notes: client.notes || "",
    phone: client.phone || "",
    email: client.email || "",
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep fields in sync when client prop changes (e.g. after save)
  useEffect(() => {
    if (!editingField) {
      setFields({
        unitDescription: client.unitDescription,
        unitCost: String(client.unitCost),
        name: client.name,
        address: client.address || "",
        notes: client.notes || "",
        phone: client.phone || "",
        email: client.email || "",
      });
    }
  }, [client, editingField]);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const totalPaid = client.payments.reduce((s, p) => s + p.amount, 0);
  const profit = totalPaid - client.unitCost;
  const sorted = [...client.payments].sort((a, b) => a.month.localeCompare(b.month));

  const startEdit = useCallback((field: EditableField) => {
    if (role !== "tolley") return;
    setEditingField(field);
  }, [role]);

  const saveField = useCallback((field: EditableField) => {
    const value = field === "unitCost"
      ? parseFloat(fields[field]) || client.unitCost
      : fields[field];
    onSave(client.id, { [field]: value });
    setEditingField(null);
  }, [fields, client.id, client.unitCost, onSave]);

  const cancelEdit = useCallback(() => {
    // Revert to original values
    setFields({
      unitDescription: client.unitDescription,
      unitCost: String(client.unitCost),
      name: client.name,
      address: client.address || "",
      notes: client.notes || "",
      phone: client.phone || "",
      email: client.email || "",
    });
    setEditingField(null);
  }, [client]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, field: EditableField) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveField(field);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }, [saveField, cancelEdit]);

  const editableCursor = role === "tolley" ? "pointer" : "default";

  function renderEditableCell(field: EditableField, value: string, extraProps?: { type?: string; className?: string; style?: React.CSSProperties; title?: string }) {
    const { type, className, style, title } = extraProps || {};
    if (editingField === field) {
      return (
        <td className={className} style={style}>
          <input
            ref={inputRef}
            className="edit-input cell-editing"
            type={type || "text"}
            value={fields[field]}
            onChange={e => setFields(f => ({ ...f, [field]: e.target.value }))}
            onBlur={() => saveField(field)}
            onKeyDown={e => handleKeyDown(e, field)}
          />
        </td>
      );
    }
    return (
      <td className={className} style={style} title={title}>
        <span
          style={{ cursor: editableCursor }}
          onClick={() => startEdit(field)}
        >
          {value}
        </span>
      </td>
    );
  }

  const rowClass = !client.active ? "inactive-row" : "";

  return (
    <tr className={rowClass}>
      {/* sticky-col-0: empty (was edit button) */}
      <td className="sticky-col-0" />

      {/* sticky-col-1: unitDescription (editable) */}
      {renderEditableCell("unitDescription", fields.unitDescription, { className: "sticky-col-1" })}

      {/* sticky-col-2: unitCost (editable) */}
      {renderEditableCell("unitCost", `$${(parseFloat(fields.unitCost) || 0).toFixed(0)}`, {
        className: "sticky-col-2",
        style: { textAlign: "right" },
        type: "number",
      })}

      {/* sticky-col-3: installDate (read-only) */}
      <td className="sticky-col-3">{fmtDate(client.installDate)}</td>

      {/* sticky-col-4: profit (read-only) */}
      <td className="sticky-col-4" style={{ textAlign: "right", color: profit >= 0 ? "#006100" : "#9c0006", fontWeight: 600 }}>${profit.toFixed(0)}</td>

      {/* name (editable) */}
      {renderEditableCell("name", fields.name)}

      {/* totalPaid (read-only) */}
      <td style={{ textAlign: "right" }}>${totalPaid.toFixed(0)}</td>

      {/* confirmed checkbox (click-only) */}
      <td style={{ textAlign: "center" }}>
        <input type="checkbox" className="confirm-check" checked={client.confirmed} onChange={e => onConfirmToggle(client.id, e.target.checked)} />
      </td>

      {/* address (editable) */}
      {renderEditableCell("address", fields.address, { title: fields.address })}

      {/* notes (editable) */}
      {renderEditableCell("notes", fields.notes, { title: fields.notes })}

      {/* phone (editable) */}
      {renderEditableCell("phone", fields.phone)}

      {/* email (editable) */}
      {renderEditableCell("email", fields.email)}

      {/* split columns */}
      {showSplit && (
        <>
          <td style={{ textAlign: "right" }}>${client.split.tolleySplit.toFixed(0)}</td>
        </>
      )}

      {/* # payments (read-only) */}
      <td style={{ textAlign: "center" }}>{client.payments.length}</td>

      {/* payment cells */}
      {sorted.map(p => (
        <WdPaymentCell key={p.id} paymentId={p.id} amount={p.amount} status={p.status} onStatusChange={onPaymentStatus} />
      ))}
      {Array.from({ length: maxPayments - sorted.length }).map((_, i) => (
        <td key={`empty-${i}`} />
      ))}
    </tr>
  );
}
