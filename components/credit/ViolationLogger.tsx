"use client";

import { useState } from "react";

type Violation = {
  id: string;
  debtId: string | null;
  collector: string;
  violationType: string;
  section: string;
  description: string;
  date: string;
  evidence: string | null;
  statutoryDamage: number;
  status: string;
};

const violationTypes = [
  {
    section: "15 USC 1692d",
    label: "Harassment",
    examples: "Repeated calls, abusive language, threats",
  },
  {
    section: "15 USC 1692c(a)(1)",
    label: "Called before 8AM or after 9PM",
    examples: "Contact outside permitted hours",
  },
  {
    section: "15 USC 1692c(b)",
    label: "Contacted third party",
    examples: "Called employer, family, or friends",
  },
  {
    section: "15 USC 1692e",
    label: "False/misleading representation",
    examples:
      "Misrepresented debt amount, threatened arrest, claimed to be attorney",
  },
  {
    section: "15 USC 1692e(5)",
    label: "Threatened illegal action",
    examples:
      "Threatened lawsuit on time-barred debt, threatened wage garnishment without judgment",
  },
  {
    section: "15 USC 1692f",
    label: "Unfair practices",
    examples:
      "Collected unauthorized fees, deposited post-dated check early",
  },
  {
    section: "15 USC 1692g",
    label: "Failed to validate debt",
    examples: "Continued collection without validating after request",
  },
  {
    section: "15 USC 1692e(11)",
    label: "Failed to identify as collector",
    examples: "Didn't disclose call was from debt collector",
  },
];

export function ViolationLogger({
  violations,
  onAdd,
}: {
  violations?: Violation[];
  onAdd?: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    collector: "",
    violationType: "fdcpa",
    section: "15 USC 1692d",
    description: "",
    date: new Date().toISOString().split("T")[0],
    evidence: "",
  });

  const totalDamages = (violations || []).reduce(
    (s, v) => s + (v.statutoryDamage || 1000),
    0
  );

  const handleAdd = async () => {
    try {
      await fetch("/api/credit/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({
        collector: "",
        violationType: "fdcpa",
        section: "15 USC 1692d",
        description: "",
        date: new Date().toISOString().split("T")[0],
        evidence: "",
      });
      onAdd?.();
    } catch {}
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
            FDCPA Violation Logger
          </h3>
          {totalDamages > 0 && (
            <p className="mt-0.5 text-xs text-green-400">
              Potential statutory damages: ${totalDamages.toLocaleString()} (
              {violations?.length} violation
              {violations?.length !== 1 ? "s" : ""} x $1,000)
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
        >
          + Log Violation
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Collector
              </label>
              <input
                value={form.collector}
                onChange={(e) =>
                  setForm({ ...form, collector: e.target.value })
                }
                placeholder="e.g., Zwicker & Associates"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">
              Violation Type
            </label>
            <select
              value={form.section}
              onChange={(e) => {
                const vt = violationTypes.find(
                  (v) => v.section === e.target.value
                );
                setForm({
                  ...form,
                  section: e.target.value,
                  description: vt?.examples || "",
                });
              }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
            >
              {violationTypes.map((vt) => (
                <option key={vt.section} value={vt.section}>
                  {vt.label} ({vt.section})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">
              Description
            </label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What happened?"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">
              Evidence
            </label>
            <input
              value={form.evidence}
              onChange={(e) =>
                setForm({ ...form, evidence: e.target.value })
              }
              placeholder="Phone log, voicemail, letter, etc."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
            />
          </div>
          <button
            onClick={handleAdd}
            className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600"
          >
            Log Violation ($1,000)
          </button>
        </div>
      )}

      {violations && violations.length > 0 ? (
        <div className="space-y-2">
          {violations.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-red-500/10 bg-red-500/5 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {v.collector}
                  </span>
                  <span className="font-mono text-xs text-red-400/60">
                    {v.section}
                  </span>
                </div>
                <span className="text-xs font-bold text-green-400">
                  +$1,000
                </span>
              </div>
              <p className="mt-0.5 text-xs text-white/50">{v.description}</p>
              <div className="mt-1 flex gap-3 text-xs text-white/30">
                <span>{v.date}</span>
                {v.evidence && <span>Evidence: {v.evidence}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/40">
          No violations logged. Document any FDCPA violations for leverage.
        </p>
      )}
    </div>
  );
}
