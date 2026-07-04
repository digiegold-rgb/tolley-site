"use client";

import { useState } from "react";

export type AdminOperator = {
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  businessName: string;
  categoryLabel: string;
  city: string | null;
  createdAt: string;
  notes: string;
  salesCount: number;
  salesTotalCents: number;
  claimed: boolean;
  intake: { idea?: string; stopping?: string; need_first?: string; heard_about?: string } | null;
};

const STATUS_TONE: Record<string, string> = {
  pending: "#ff8842",
  approved: "#39d98a",
  paused: "#ffb020",
  bought_out: "#8ab4ff",
};

export function AdminOperatorRow({ operator }: { operator: AdminOperator }) {
  const [status, setStatus] = useState(operator.status);
  const [notes, setNotes] = useState(operator.notes);
  const [busy, setBusy] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "approve" | "pause" | "note", note?: string) {
    setBusy(action);
    setErr(null);
    setNoteSaved(false);
    try {
      const res = await fetch("/api/sales/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: operator.slug, action, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErr((data && data.error) || "Action failed.");
      } else {
        if (action === "note") setNoteSaved(true);
        else if (data?.status) setStatus(data.status);
      }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "#1c1e22", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider"
              style={{ backgroundColor: "#141518", color: STATUS_TONE[status] ?? "#a7a49d" }}
            >
              {status}
            </span>
            <h3 className="truncate text-lg font-bold text-white">{operator.businessName}</h3>
          </div>
          <p className="mt-1 text-xs" style={{ color: "#a7a49d" }}>
            {operator.categoryLabel}
            {operator.city ? ` · ${operator.city}` : ""} · {new Date(operator.createdAt).toLocaleDateString()}
            {operator.claimed ? " · claimed" : " · unclaimed"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "#a7a49d" }}>
            {operator.name}
            {operator.phone ? ` · ${operator.phone}` : ""}
            {operator.email ? ` · ${operator.email}` : ""}
          </p>
        </div>
        <div className="text-right">
          <a href={`/biz/${operator.slug}`} target="_blank" className="text-sm font-semibold" style={{ color: "#ff8842" }}>
            /biz/{operator.slug} →
          </a>
          <p className="mt-1 text-xs" style={{ color: "#a7a49d" }}>
            {operator.salesCount} sales · ${(operator.salesTotalCents / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {operator.intake && (
        <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#141518", color: "#d8d5cf" }}>
          {operator.intake.idea && <p><span style={{ color: "#a7a49d" }}>Idea:</span> {operator.intake.idea}</p>}
          {operator.intake.stopping && <p className="mt-1"><span style={{ color: "#a7a49d" }}>Stopping:</span> {operator.intake.stopping}</p>}
          {operator.intake.need_first && <p className="mt-1"><span style={{ color: "#a7a49d" }}>Needs first:</span> {operator.intake.need_first}</p>}
          {operator.intake.heard_about && <p className="mt-1"><span style={{ color: "#a7a49d" }}>Heard via:</span> {operator.intake.heard_about}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={busy !== null || status === "approved"}
          className="rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40"
          style={{ backgroundColor: "#ff6a13", color: "#141518" }}
        >
          {busy === "approve" ? "…" : status === "approved" ? "Approved ✓" : "Approve (unlock Buy)"}
        </button>
        <button
          type="button"
          onClick={() => act("pause")}
          disabled={busy !== null || status === "paused"}
          className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ backgroundColor: "#26282d", color: "#f4f2ee" }}
        >
          {busy === "pause" ? "…" : "Pause"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNoteSaved(false); }}
          placeholder="Private note…"
          className="flex-1 rounded-lg border border-white/10 bg-[#141518] px-3 py-2 text-sm text-[#f4f2ee] outline-none"
        />
        <button
          type="button"
          onClick={() => act("note", notes)}
          disabled={busy !== null}
          className="rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ backgroundColor: "#26282d", color: "#a7a49d" }}
        >
          {busy === "note" ? "…" : noteSaved ? "Saved ✓" : "Save note"}
        </button>
      </div>

      {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
    </div>
  );
}
