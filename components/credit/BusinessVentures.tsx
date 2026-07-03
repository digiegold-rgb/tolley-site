"use client";

import { useState, useEffect } from "react";

type Venture = {
  id: string;
  name: string;
  url?: string | null;
  monthlyRevenue: number;
  provable: boolean;
  status: string;
  note?: string | null;
};

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

const STATUS_STYLE: Record<string, string> = {
  live: "bg-green-500/20 text-green-400",
  ramping: "bg-yellow-500/20 text-yellow-400",
  cash: "bg-orange-500/20 text-orange-400",
  planned: "bg-white/10 text-white/50",
};

export function BusinessVentures({
  ventures: initial,
  onSaved,
}: {
  ventures?: Venture[];
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<Venture[]>(initial ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usedIncome, setUsedIncome] = useState(false);

  useEffect(() => {
    if (!dirty && initial) setRows(initial);
  }, [initial, dirty]);

  const totalMRR = rows.reduce((s, v) => s + (Number(v.monthlyRevenue) || 0), 0);
  const provableMRR = rows
    .filter((v) => v.provable)
    .reduce((s, v) => s + (Number(v.monthlyRevenue) || 0), 0);
  const cashMRR = totalMRR - provableMRR;

  const update = (id: string, patch: Partial<Venture>) => {
    setRows((r) => r.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    setDirty(true);
  };
  const remove = (id: string) => {
    setRows((r) => r.filter((v) => v.id !== id));
    setDirty(true);
  };
  const add = () => {
    setRows((r) => [
      ...r,
      {
        id: `v_${Date.now()}`,
        name: "New venture",
        monthlyRevenue: 0,
        provable: true,
        status: "planned",
        note: "",
      },
    ]);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/credit/ventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventures: rows }),
      });
      setDirty(false);
      onSaved?.();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const useAsIncome = async () => {
    setSaving(true);
    try {
      await fetch("/api/credit/heloc-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentedAnnualIncome: provableMRR * 12 }),
      });
      setUsedIncome(true);
      onSaved?.();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#00d4ff]/25 bg-gradient-to-b from-[#0d1117] to-[#0d1117] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-black tracking-wide text-[#00d4ff]">
            INCOME & VENTURES
          </h3>
          <p className="text-xs text-white/40">
            The real lever. Programmable MRR across what we&apos;re building on
            tolley.io.
          </p>
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00d4ff]/25 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>

      {/* Headline numbers */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-4 py-3 text-center">
          <p className="text-2xl font-black text-[#00d4ff]">{usd(totalMRR)}</p>
          <p className="text-[0.65rem] text-white/50">Total MRR</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
          <p className="text-2xl font-black text-white">
            {usd(totalMRR * 12)}
          </p>
          <p className="text-[0.65rem] text-white/50">Annual run-rate</p>
        </div>
        <div className="col-span-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center sm:col-span-1">
          <p className="text-2xl font-black text-green-400">
            {usd(provableMRR * 12)}
          </p>
          <p className="text-[0.65rem] text-white/50">
            Provable / yr · {usd(cashMRR)}/mo cash
          </p>
        </div>
      </div>

      {/* Venture rows */}
      <div className="space-y-2">
        {rows.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={v.name}
                onChange={(e) => update(v.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm font-medium text-white focus:border-[#00d4ff]/50 focus:outline-none"
              />
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1">
                <span className="text-xs text-white/40">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={v.monthlyRevenue}
                  onChange={(e) =>
                    update(v.id, {
                      monthlyRevenue:
                        parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0,
                    })
                  }
                  className="w-20 bg-transparent text-right text-sm font-bold text-white focus:outline-none"
                />
                <span className="text-[0.6rem] text-white/30">/mo</span>
              </div>
              <button
                onClick={() => update(v.id, { provable: !v.provable })}
                className={`rounded-lg px-2 py-1 text-[0.65rem] font-bold ${
                  v.provable
                    ? "bg-green-500/20 text-green-400"
                    : "bg-orange-500/20 text-orange-400"
                }`}
                title="Provable = documented/taxed income a lender will count"
              >
                {v.provable ? "PROVABLE" : "CASH"}
              </button>
              <select
                value={v.status}
                onChange={(e) => update(v.id, { status: e.target.value })}
                className={`rounded-lg border-0 px-2 py-1 text-[0.65rem] font-bold ${STATUS_STYLE[v.status] || STATUS_STYLE.planned}`}
              >
                <option value="live">LIVE</option>
                <option value="ramping">RAMPING</option>
                <option value="cash">CASH</option>
                <option value="planned">PLANNED</option>
              </select>
              <button
                onClick={() => remove(v.id)}
                className="rounded-lg px-2 py-1 text-xs text-white/30 hover:text-red-400"
                title="Remove"
              >
                ✕
              </button>
            </div>
            {v.note && (
              <p className="mt-1.5 pl-1 text-[0.65rem] text-white/40">{v.note}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={add}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
        >
          + Add venture
        </button>
        <button
          onClick={useAsIncome}
          disabled={saving || provableMRR === 0}
          className="rounded-lg border border-green-500/40 bg-green-500/15 px-3 py-1.5 text-sm font-medium text-green-300 hover:bg-green-500/25 disabled:opacity-40"
          title="Push provable annual run-rate into the HELOC DTI gate"
        >
          {usedIncome ? "✓ Sent to HELOC gate" : "Use provable as HELOC income →"}
        </button>
        <span className="text-[0.65rem] text-white/35">
          Only the green PROVABLE rows count toward a loan. Cash → route through
          the S-corp to convert it.
        </span>
      </div>
    </div>
  );
}
