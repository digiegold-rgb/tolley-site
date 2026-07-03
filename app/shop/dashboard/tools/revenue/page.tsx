"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface DryRun {
  ok: boolean;
  dryRun: true;
  sheetCount: number;
  entryCount: number;
  byBusiness: Record<string, number>;
  byChannel: Record<string, number>;
  skippedSheets: { name: string; reason: string }[];
  sample: {
    business: string;
    channel: string | null;
    itemDesc: string | null;
    date: string | null;
    gross: number | null;
    cost: number | null;
    profit: number | null;
  }[];
}

interface ImportResult {
  ok: boolean;
  batchId: string;
  imported: number;
  updated: number;
  byBusiness: Record<string, number>;
}

interface BatchHistory {
  recent: {
    id: string;
    sourceFile: string;
    sheetCount: number;
    rowsImported: number;
    rowsUpdated: number;
    rowsSkipped: number;
    createdAt: string;
  }[];
  totalEntries: number;
}

export default function RevenueImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BatchHistory | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refreshHistory() {
    try {
      const r = await fetch("/api/shop/admin/revenue/import");
      if (r.ok) setHistory(await r.json());
    } catch {}
  }

  useEffect(() => {
    refreshHistory();
  }, []);

  async function handleUpload(commit: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (!commit) fd.append("dryRun", "1");
      const res = await fetch("/api/shop/admin/revenue/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (commit) {
        setResult(data as ImportResult);
        setDry(null);
        refreshHistory();
      } else {
        setDry(data as DryRun);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Revenue Import</h1>
        <p className="mt-1 text-sm text-white/50">
          Upload a Numbers/Excel workbook. Each sheet = one business+channel.
          Drop-in weekly. Re-uploads update existing rows by{" "}
          <code className="text-white/70">(file, sheet, row, item, gross, cost)</code>.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setDry(null);
              setResult(null);
              setError(null);
            }}
            className="block flex-1 cursor-pointer rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-purple-500/30 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-purple-100 hover:file:bg-purple-500/40"
          />
          <button
            type="button"
            onClick={() => handleUpload(false)}
            disabled={!file || busy}
            className="rounded-md border border-white/15 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5 disabled:opacity-40"
          >
            {busy ? "…" : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => handleUpload(true)}
            disabled={!file || busy}
            className="rounded-md bg-emerald-500/25 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/40 disabled:opacity-40"
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
        <p className="mt-2 text-[0.65rem] text-white/40">
          Numbers → File → Export To → Excel. Tab name → business+channel
          (split on "&nbsp;-&nbsp;"). Numbers' "Totals", "Cash Flow",
          "Drawings", and "Export Summary" tabs are skipped.
        </p>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      {dry && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-amber-200">Preview</h2>
              <p className="mt-0.5 text-xs text-white/50">
                {dry.entryCount} rows across {dry.sheetCount} sheets. Click
                "Import" above to commit.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-white/40">
                By business
              </p>
              <div className="mt-1 space-y-1">
                {Object.entries(dry.byBusiness).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-white/70">{k}</span>
                    <span className="text-white">{v} rows</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-white/40">
                Skipped sheets
              </p>
              <div className="mt-1 space-y-1 text-[0.7rem] text-white/50">
                {dry.skippedSheets.length === 0 ? (
                  <p>(none)</p>
                ) : (
                  dry.skippedSheets.map((s) => (
                    <div key={s.name}>
                      <span className="text-white/70">{s.name}</span> —{" "}
                      <span>{s.reason}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[0.65rem] uppercase tracking-wide text-white/40">
              Sample rows
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[0.6rem] uppercase text-white/40">
                  <tr className="border-b border-white/10">
                    <th className="py-1 pr-3 text-left">Business</th>
                    <th className="py-1 pr-3 text-left">Channel</th>
                    <th className="py-1 pr-3 text-left">Item</th>
                    <th className="py-1 pr-3 text-right">Gross</th>
                    <th className="py-1 pr-3 text-right">Cost</th>
                    <th className="py-1 pr-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="text-white/70">
                  {dry.sample.map((s, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-1 pr-3">{s.business}</td>
                      <td className="py-1 pr-3 text-white/40">{s.channel}</td>
                      <td className="py-1 pr-3">{s.itemDesc?.slice(0, 32)}</td>
                      <td className="py-1 pr-3 text-right">
                        {s.gross != null ? `$${s.gross.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {s.cost != null ? `$${s.cost.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={`py-1 pr-3 text-right ${
                          (s.profit ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {s.profit != null ? `$${s.profit.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-5 text-sm">
          <p className="font-semibold text-emerald-200">
            ✓ Imported {result.imported} new + {result.updated} updated rows
          </p>
          <p className="mt-1 text-xs text-white/60">
            Across {Object.keys(result.byBusiness).length} businesses. View on{" "}
            <Link
              href="/shop/dashboard/analytics"
              className="text-emerald-300 underline"
            >
              Revenue & Platforms
            </Link>
            .
          </p>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white/80">Recent imports</h2>
        {!history ? (
          <p className="mt-2 text-xs text-white/40">Loading…</p>
        ) : history.recent.length === 0 ? (
          <p className="mt-2 text-xs text-white/40">No imports yet.</p>
        ) : (
          <div className="mt-3 space-y-1.5 text-xs">
            {history.recent.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-1.5"
              >
                <div>
                  <p className="text-white/80">{b.sourceFile}</p>
                  <p className="text-[0.6rem] text-white/40">
                    {new Date(b.createdAt).toLocaleString()} · {b.sheetCount}{" "}
                    sheets
                  </p>
                </div>
                <div className="text-right text-[0.7rem]">
                  <p>
                    <span className="text-emerald-300">+{b.rowsImported}</span>{" "}
                    new ·{" "}
                    <span className="text-amber-300">~{b.rowsUpdated}</span>{" "}
                    updated
                  </p>
                  <p className="text-white/40">{b.rowsSkipped} skipped</p>
                </div>
              </div>
            ))}
            <p className="mt-2 text-[0.65rem] text-white/40">
              Total entries in DB:{" "}
              <span className="text-white/70">{history.totalEntries}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
