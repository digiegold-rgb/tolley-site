"use client";

import { useState } from "react";
import type { DisputeDoc, DisputeRow } from "@/lib/credit/types";

const typeLabels: Record<string, string> = {
  fcra_dispute: "FCRA Dispute",
  "609_request": "609 Request",
  fdcpa_validation: "Debt Validation",
  goodwill: "Goodwill Letter",
  pay_for_delete: "Pay-for-Delete",
  instant_dispute: "Instant Dispute",
  kikoff_dispute: "Kikoff Dispute",
};

const channelLabels: Record<string, string> = {
  online: "Online",
  kikoff: "Kikoff",
  certified_mail: "Certified mail",
  email: "Email",
  other: "Other",
};

const docKinds: DisputeDoc["kind"][] = [
  "letter",
  "court_order",
  "id",
  "address_proof",
  "other",
];

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

const emptyForm = {
  type: "fcra_dispute",
  creditor: "",
  bureau: "transunion",
  status: "sent",
  sentDate: new Date().toISOString().split("T")[0],
  filedDate: new Date().toISOString().split("T")[0],
  trackingNumber: "",
  notes: "",
  fileNumber: "",
  accountLast4: "",
  caseNumber: "",
  channel: "certified_mail",
  docs: [] as DisputeDoc[],
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function filedOrSent(d: DisputeRow): string | null {
  return d.filedDate || d.sentDate || null;
}

export function DisputeTracker({
  disputes,
  onAddNew,
}: {
  disputes?: DisputeRow[];
  onAddNew?: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const handleAdd = async () => {
    const filedDate = form.filedDate || form.sentDate || null;
    const sentDate = form.sentDate || form.filedDate || null;
    try {
      await fetch("/api/credit/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          creditor: form.creditor,
          bureau: form.bureau,
          status: form.status,
          sentDate,
          filedDate,
          trackingNumber: form.trackingNumber || null,
          notes: form.notes || null,
          fileNumber: form.fileNumber || null,
          accountLast4: form.accountLast4 || null,
          caseNumber: form.caseNumber || null,
          channel: form.channel || null,
          docs: form.docs.filter((d) => d.label || d.pathOrUrl),
        }),
      });
      setShowAddForm(false);
      setForm({
        ...emptyForm,
        sentDate: new Date().toISOString().split("T")[0],
        filedDate: new Date().toISOString().split("T")[0],
        docs: [],
      });
      onAddNew?.();
    } catch {}
  };

  const updateDoc = (index: number, patch: Partial<DisputeDoc>) => {
    setForm({
      ...form,
      docs: form.docs.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    });
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
                <option value="all">All bureaus</option>
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
                Filed / sent date
              </label>
              <input
                type="date"
                value={form.sentDate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sentDate: e.target.value,
                    filedDate: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                File number
              </label>
              <input
                value={form.fileNumber}
                onChange={(e) =>
                  setForm({ ...form, fileNumber: e.target.value })
                }
                placeholder="Instant Dispute / Kikoff id"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Account last 4
              </label>
              <input
                value={form.accountLast4}
                onChange={(e) =>
                  setForm({ ...form, accountLast4: e.target.value })
                }
                placeholder="8534"
                maxLength={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Case number
              </label>
              <input
                value={form.caseNumber}
                onChange={(e) =>
                  setForm({ ...form, caseNumber: e.target.value })
                }
                placeholder="2516-CV04747"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Channel
              </label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
              >
                {Object.entries(channelLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Documents</label>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    docs: [
                      ...form.docs,
                      { label: "", pathOrUrl: "", kind: "other" },
                    ],
                  })
                }
                className="text-[0.65rem] text-[#00d4ff] hover:underline"
              >
                + Add doc
              </button>
            </div>
            {form.docs.map((doc, i) => (
              <div key={i} className="grid grid-cols-6 gap-2">
                <input
                  value={doc.label}
                  onChange={(e) => updateDoc(i, { label: e.target.value })}
                  placeholder="Label"
                  className="col-span-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-white/20"
                />
                <input
                  value={doc.pathOrUrl}
                  onChange={(e) => updateDoc(i, { pathOrUrl: e.target.value })}
                  placeholder="Path or URL"
                  className="col-span-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-white/20"
                />
                <select
                  value={doc.kind}
                  onChange={(e) =>
                    updateDoc(i, { kind: e.target.value as DisputeDoc["kind"] })
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white"
                >
                  {docKinds.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      docs: form.docs.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-[0.65rem] text-white/40 hover:text-red-400"
                >
                  remove
                </button>
              </div>
            ))}
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
            const filed = filedOrSent(d);
            const docs = d.docs ?? [];
            return (
              <div
                key={d.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
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
                    {d.accountLast4 && (
                      <span className="text-xs text-white/30">
                        ····{d.accountLast4}
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusFlow[d.status]?.color || "bg-white/10 text-white/40"}`}
                  >
                    {statusFlow[d.status]?.label || d.status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/40">
                  {filed && <span>Filed: {filed}</span>}
                  {d.channel && (
                    <span>{channelLabels[d.channel] || d.channel}</span>
                  )}
                  {d.fileNumber && (
                    <span className="font-mono">file {d.fileNumber}</span>
                  )}
                  {d.caseNumber && <span>case {d.caseNumber}</span>}
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
                {docs.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[0.65rem] text-white/35">
                    {docs.map((doc, i) => (
                      <li key={`${doc.pathOrUrl}-${i}`}>
                        {doc.label || doc.pathOrUrl}{" "}
                        <span className="text-white/25">({doc.kind})</span>
                      </li>
                    ))}
                  </ul>
                )}
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
