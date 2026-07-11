"use client";

import { useState } from "react";

import { CHANNEL_ICON, type HqQueueTouch } from "./types";

interface Props {
  touches: HqQueueTouch[];
  loading: boolean;
  busyId: string | null;
  onRefresh: () => void;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onSaveEdit: (id: string, subject: string, body: string) => Promise<boolean>;
}

export function HqApprovalQueue({
  touches,
  loading,
  busyId,
  onRefresh,
  onApprove,
  onDiscard,
  onSaveEdit,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [armedOffer, setArmedOffer] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // One deliberate click sends the whole batch: first click arms, second fires.
  async function bulkSend(offer: string) {
    if (armedOffer !== offer) {
      setArmedOffer(offer);
      setBulkResult(null);
      return;
    }
    setArmedOffer(null);
    setBulkBusy(true);
    try {
      const res = await fetch("/api/hq/touches/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer, count: 10 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkResult(`⚠ ${data.error || res.status}`);
      } else {
        const failNote = data.failed?.length ? ` · ${data.failed.length} failed` : "";
        setBulkResult(
          `✓ ${data.sent.length} ${offer} leads pushed to Instantly (timed sequence takes it from here)${failNote}`,
        );
        onRefresh();
      }
    } catch (e) {
      setBulkResult(`⚠ ${e instanceof Error ? e.message : "send failed"}`);
    } finally {
      setBulkBusy(false);
    }
  }

  function startEdit(t: HqQueueTouch) {
    setEditId(t.id);
    setEditSubject(t.subject ?? "");
    setEditBody(t.body ?? "");
  }

  async function saveEdit(id: string) {
    const ok = await onSaveEdit(id, editSubject, editBody);
    if (ok) setEditId(null);
  }

  // Best-fit first; nulls sink to the bottom. Copy so we don't mutate props.
  const sortedTouches = [...touches].sort((a, b) => {
    const sa = a.lead.score;
    const sb = b.lead.score;
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sb - sa;
  });

  function scorePill(score: number | null) {
    if (score == null) return null;
    const colors =
      score >= 80
        ? { bg: "#e6f7ed", fg: "#137333" }
        : score >= 60
          ? { bg: "#fef7e0", fg: "#9a6700" }
          : { bg: "#f1f3f4", fg: "#5f6368" };
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 10,
          background: colors.bg,
          color: colors.fg,
        }}
      >
        fit {score}
      </span>
    );
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Outreach drafts{" "}
          {touches.length > 0 && <span style={{ color: "#0d6efd" }}>({touches.length})</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            className="btn btn-sm"
            style={{ background: armedOffer === "site" ? "#dc3545" : "#0d6efd", color: "#fff", fontWeight: 700 }}
            onClick={() => bulkSend("site")}
            disabled={bulkBusy || loading}
          >
            {bulkBusy ? "Sending…" : armedOffer === "site" ? "Confirm: send 10 site" : "⚡ Send top 10 site"}
          </button>
          <button
            className="btn btn-sm"
            style={{ background: armedOffer === "delivery" ? "#dc3545" : "#198754", color: "#fff", fontWeight: 700 }}
            onClick={() => bulkSend("delivery")}
            disabled={bulkBusy || loading}
          >
            {bulkBusy ? "Sending…" : armedOffer === "delivery" ? "Confirm: send 10 delivery" : "⚡ Send top 10 delivery"}
          </button>
          <button className="btn btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {bulkResult && (
        <div style={{ fontSize: 12, fontWeight: 600, padding: "6px 0", color: bulkResult.startsWith("✓") ? "#137333" : "#b00020" }}>
          {bulkResult}
        </div>
      )}

      {touches.length === 0 && !loading && (
        <div style={{ fontSize: 13, color: "#999", padding: "8px 0" }}>
          No drafts waiting. Outreach written by the growth agents lands here for approval —
          approved touches are picked up by the sender cron.
        </div>
      )}

      {sortedTouches.map((t) => (
        <div key={t.id} style={{ borderTop: "1px solid #eef0f2", padding: "10px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span className="pill pill-channel">
              {CHANNEL_ICON[t.channel] || ""} {t.channel}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.lead.name}</span>
            {scorePill(t.lead.score)}
            <span className={`pill pill-offer-${t.lead.offer}`}>{t.lead.offer}</span>
            <span style={{ fontSize: 11, color: "#999" }}>
              {t.lead.city ? `${t.lead.city} · ` : ""}
              {t.channel === "email"
                ? t.lead.email || "⚠ no email on lead"
                : t.lead.phone || (t.channel === "sms" || t.channel === "call" ? "⚠ no phone on lead" : "")}
            </span>
          </div>

          {editId === t.id ? (
            <div>
              {t.channel === "email" && (
                <input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Subject"
                  style={{ width: "100%", fontSize: 13, padding: 6, border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box", marginBottom: 4 }}
                />
              )}
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
                style={{ width: "100%", fontSize: 13, padding: 6, border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
              <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                <button className="btn btn-sm btn-primary" onClick={() => saveEdit(t.id)} disabled={busyId === t.id}>
                  {busyId === t.id ? "…" : "Save"}
                </button>
                <button className="btn btn-sm" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {t.subject && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "#444" }}>{t.subject}</div>
              )}
              <div style={{ fontSize: 13, color: "#333", whiteSpace: "pre-wrap", marginBottom: 6 }}>
                {t.body || <em style={{ color: "#999" }}>(empty body)</em>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-sm btn-primary" onClick={() => onApprove(t.id)} disabled={busyId === t.id}>
                  {busyId === t.id ? "…" : "✓ Approve"}
                </button>
                <button className="btn btn-sm" onClick={() => startEdit(t)} disabled={busyId === t.id}>
                  Edit
                </button>
                <button
                  className="btn btn-sm"
                  style={{ color: "#c0392b" }}
                  onClick={() => onDiscard(t.id)}
                  disabled={busyId === t.id}
                >
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
