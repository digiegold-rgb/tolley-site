"use client";

import { useState } from "react";

type Dispute = {
  id: string;
  type: string;
  debtId: string | null;
  creditor: string;
  bureau: string | null;
  status: string;
  sentDate: string | null;
  responseDeadline: string | null;
  resolvedDate: string | null;
  outcome: string | null;
  trackingNumber: string | null;
  notes: string | null;
};

const typeLabels: Record<string, string> = {
  fcra_dispute: "FCRA Dispute",
  "609_request": "609 Request",
  fdcpa_validation: "Debt Validation",
  goodwill: "Goodwill Letter",
  pay_for_delete: "Pay-for-Delete",
};

const statusFlow: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-white/10 text-white/40" },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400" },
  pending_response: {
    label: "Pending Response",
    color: "bg-yellow-500/20 text-yellow-400",
  },
  resolved: { label: "Resolved", color: "bg-green-500/20 text-green-400" },
  escalated: { label: "Escalated", color: "bg-red-500/20 text-red-400" },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function DisputeTracker({
  disputes,
  onAddNew,
}: {
  disputes?: Dispute[];
  onAddNew?: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    type: "fcra_dispute",
    creditor: "",
    bureau: "transunion",
    status: "sent",
    sentDate: new Date().toISOString().split("T")[0],
    trackingNumber: "",
    notes: "",
  });

  const handleAdd = async () => {
    try {
      await fetch("/api/credit/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowAddForm(false);
      setForm({
        type: "fcra_dispute",
        creditor: "",
        bureau: "transunion",
        status: "sent",
        sentDate: new Date().toISOString().split("T")[0],
        trackingNumber: "",
        notes: "",
      });
      onAddNew?.();
    } catch {}
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
          Dispute Tracker
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-3 py-1.5 text-xs font-medium text-[#00d4ff] hover:bg-[#00d4ff]/20"
        >
          + Add Dispute
        </button>
      </div>

      {showAddForm && (
        <div className="mb-4 space-y-3 rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-white/50">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
              >
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Bureau
              </label>
              <select
                value={form.bureau}
                onChange={(e) => setForm({ ...form, bureau: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
              >
                <option value="transunion">TransUnion</option>
                <option value="equifax">Equifax</option>
                <option value="experian">Experian</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Creditor
              </label>
              <input
                value={form.creditor}
                onChange={(e) =>
                  setForm({ ...form, creditor: e.target.value })
                }
                placeholder="e.g., Chase, PNC"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Sent Date
              </label>
              <input
                type="date"
                value={form.sentDate}
                onChange={(e) =>
                  setForm({ ...form, sentDate: e.target.value })
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">
              Tracking # (certified mail)
            </label>
            <input
              value={form.trackingNumber}
              onChange={(e) =>
                setForm({ ...form, trackingNumber: e.target.value })
              }
              placeholder="9400111899223100XXXX"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What are you disputing?"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
            />
          </div>
          <button
            onClick={handleAdd}
            className="rounded-lg bg-[#00d4ff] px-4 py-2 text-xs font-bold text-black hover:bg-[#00b4d8]"
          >
            Save Dispute
          </button>
        </div>
      )}

      {!disputes || disputes.length === 0 ? (
        <p className="text-sm text-white/40">
          No disputes tracked yet. Add your first dispute or use the Letter
          Generator.
        </p>
      ) : (
        <div className="space-y-2">
          {disputes.map((d) => {
            const days = daysUntil(d.responseDeadline);
            const overdue = days !== null && days < 0;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {d.creditor}
                    </span>
                    <span className="text-xs text-white/40">
                      {typeLabels[d.type] || d.type}
                    </span>
                    {d.bureau && (
                      <span className="text-xs text-white/30">
                        ({d.bureau})
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusFlow[d.status]?.color || "bg-white/10 text-white/40"}`}
                  >
                    {statusFlow[d.status]?.label || d.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                  {d.sentDate && <span>Sent: {d.sentDate}</span>}
                  {d.responseDeadline && (
                    <span
                      className={
                        overdue
                          ? "font-bold text-red-400"
                          : days !== null && days <= 7
                            ? "text-yellow-400"
                            : ""
                      }
                    >
                      {overdue
                        ? `OVERDUE by ${Math.abs(days!)} days — FCRA violation!`
                        : `Deadline: ${d.responseDeadline} (${days} days)`}
                    </span>
                  )}
                  {d.trackingNumber && (
                    <span className="font-mono">{d.trackingNumber}</span>
                  )}
                </div>
                {d.notes && (
                  <p className="mt-1 text-xs italic text-white/30">
                    {d.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
