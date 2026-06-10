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

  function startEdit(t: HqQueueTouch) {
    setEditId(t.id);
    setEditSubject(t.subject ?? "");
    setEditBody(t.body ?? "");
  }

  async function saveEdit(id: string) {
    const ok = await onSaveEdit(id, editSubject, editBody);
    if (ok) setEditId(null);
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Outreach drafts{" "}
          {touches.length > 0 && <span style={{ color: "#0d6efd" }}>({touches.length})</span>}
        </div>
        <button className="btn btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {touches.length === 0 && !loading && (
        <div style={{ fontSize: 13, color: "#999", padding: "8px 0" }}>
          No drafts waiting. Outreach written by the growth agents lands here for approval —
          approved touches are picked up by the sender cron.
        </div>
      )}

      {touches.map((t) => (
        <div key={t.id} style={{ borderTop: "1px solid #eef0f2", padding: "10px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span className="pill pill-channel">
              {CHANNEL_ICON[t.channel] || ""} {t.channel}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.lead.name}</span>
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
