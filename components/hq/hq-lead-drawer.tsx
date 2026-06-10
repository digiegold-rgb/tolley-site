"use client";

import { useEffect, useState } from "react";

import { HQ_STAGES } from "@/lib/hq";
import { CHANNEL_ICON, STAGE_LABEL, type HqLead } from "./types";

interface Props {
  lead: HqLead;
  saving: boolean;
  onClose: () => void;
  onSave: (id: string, fields: Record<string, string | number | null>) => Promise<boolean>;
}

export function HqLeadDrawer({ lead, saving, onClose, onSave }: Props) {
  const [stage, setStage] = useState(lead.stage);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [ownerName, setOwnerName] = useState(lead.ownerName ?? "");
  const [demoUrl, setDemoUrl] = useState(lead.demoUrl ?? "");

  // Re-seed the form when a different lead is opened
  useEffect(() => {
    setStage(lead.stage);
    setNotes(lead.notes ?? "");
    setEmail(lead.email ?? "");
    setPhone(lead.phone ?? "");
    setOwnerName(lead.ownerName ?? "");
    setDemoUrl(lead.demoUrl ?? "");
  }, [lead]);

  const dirty =
    stage !== lead.stage ||
    notes !== (lead.notes ?? "") ||
    email !== (lead.email ?? "") ||
    phone !== (lead.phone ?? "") ||
    ownerName !== (lead.ownerName ?? "") ||
    demoUrl !== (lead.demoUrl ?? "");

  async function handleSave() {
    const ok = await onSave(lead.id, {
      stage,
      notes: notes.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      ownerName: ownerName.trim() || null,
      demoUrl: demoUrl.trim() || null,
    });
    if (ok) onClose();
  }

  const factRow = (label: string, value: React.ReactNode) =>
    value ? (
      <div style={{ display: "flex", gap: 6, fontSize: 12, padding: "2px 0" }}>
        <span style={{ color: "#6e6e73", minWidth: 86, fontWeight: 600 }}>{label}</span>
        <span style={{ wordBreak: "break-word" }}>{value}</span>
      </div>
    ) : null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <h3>{lead.name}</h3>
            <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
              <span className={`pill pill-offer-${lead.offer}`}>{lead.offer}</span>
              {lead.score !== null && <span className="pill pill-score">score {lead.score}</span>}
              {lead.city && <span className="pill pill-city">{lead.city}</span>}
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          {/* Scraped facts */}
          <div style={{ marginBottom: 6 }}>
            {factRow("Category", lead.category)}
            {factRow("Address", lead.address)}
            {factRow(
              "Website",
              lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer" style={{ color: "#3a63af" }}>
                  {lead.website}
                </a>
              )
            )}
            {factRow(
              "Site score",
              lead.websiteScore !== null ? `${lead.websiteScore}/100` : null
            )}
            {factRow("Site notes", lead.websiteNotes)}
            {factRow(
              "Rating",
              lead.rating !== null ? `${lead.rating}★ (${lead.reviews ?? 0} reviews)` : null
            )}
            {factRow(
              "Demo",
              lead.demoUrl && (
                <a href={lead.demoUrl} target="_blank" rel="noreferrer" style={{ color: "#3a63af" }}>
                  {lead.demoUrl}
                </a>
              )
            )}
            {factRow(
              "Source",
              `${lead.source}${lead.emailSource ? ` · email: ${lead.emailSource}` : ""}`
            )}
            {factRow("Added", new Date(lead.createdAt).toLocaleDateString())}
          </div>

          {/* Editable fields */}
          <label>Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {HQ_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s] || s}
              </option>
            ))}
          </select>

          <div className="field-grid">
            <div>
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label>Owner</label>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label>Demo URL</label>
              <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="—" />
            </div>
          </div>

          <label>Notes</label>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="—" />

          {/* Touch history */}
          <label style={{ marginTop: 14 }}>
            Touches ({lead.touches.length})
          </label>
          {lead.touches.length === 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 0" }}>
              No outreach logged yet.
            </div>
          )}
          {lead.touches.map((t) => (
            <div key={t.id} className="touch-item">
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                <span className="pill pill-channel">
                  {CHANNEL_ICON[t.channel] || ""} {t.channel}
                </span>
                <span className={`pill pill-status-${t.status}`}>{t.status}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>
                  {t.direction === "in" ? "← in" : "→ out"} ·{" "}
                  {new Date(t.sentAt || t.createdAt).toLocaleString()}
                </span>
              </div>
              {t.subject && (
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{t.subject}</div>
              )}
              {t.body && <div className="touch-body">{t.body}</div>}
            </div>
          ))}
        </div>

        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
