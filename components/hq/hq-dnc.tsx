"use client";

import { useState } from "react";

import type { HqLead } from "./types";

/**
 * Outreach-history tab: who we already reached out to (so nobody gets
 * double-touched) and who asked never to hear from us again. Opt-out replies
 * land here automatically via the Instantly webhook; the 🚫 button covers
 * phone/manual opt-outs.
 */

const GROUPS: { key: string; title: string; stages: string[]; hint: string }[] = [
  {
    key: "dnc",
    title: "🚫 Do Not Contact",
    stages: ["do_not_contact"],
    hint: "Asked to never hear from us. Blocked in Instantly too — no send path can touch them.",
  },
  {
    key: "replied",
    title: "📩 Replied — in conversation",
    stages: ["replied", "booked"],
    hint: "Sequence auto-stopped on reply. These are yours to close.",
  },
  {
    key: "contacted",
    title: "📤 Already contacted — hands off",
    stages: ["contacted"],
    hint: "In an active sequence (timed follow-ups running). Don't re-add or double-touch.",
  },
];

export function HqDnc({
  leads,
  busy,
  onMarkDnc,
}: {
  leads: HqLead[];
  busy: boolean;
  onMarkDnc: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="panel">
      {GROUPS.map((g) => {
        const rows = leads
          .filter((l) => g.stages.includes(l.stage))
          .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
        return (
          <div key={g.key} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {g.title} <span style={{ color: "#0d6efd" }}>({rows.length})</span>
            </div>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>{g.hint}</div>
            {rows.length === 0 && (
              <div style={{ fontSize: 12, color: "#bbb", padding: "4px 0" }}>None yet.</div>
            )}
            {rows.map((l) => (
              <div
                key={l.id}
                style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #eef0f2", padding: "7px 0", flexWrap: "wrap" }}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</span>
                <span className={`pill pill-offer-${l.offer}`}>{l.offer}</span>
                <span style={{ fontSize: 11, color: "#999" }}>
                  {l.city ? `${l.city} · ` : ""}
                  {l.email || l.phone || ""}
                </span>
                <span style={{ fontSize: 10, color: "#bbb", marginLeft: "auto" }}>
                  {new Date(l.updatedAt).toLocaleDateString()}
                </span>
                {g.key !== "dnc" && (
                  <button
                    className="btn btn-sm"
                    style={confirmId === l.id ? { background: "#dc3545", color: "#fff" } : {}}
                    disabled={busy}
                    onClick={() => {
                      if (confirmId === l.id) {
                        setConfirmId(null);
                        onMarkDnc(l.id);
                      } else {
                        setConfirmId(l.id);
                      }
                    }}
                  >
                    {confirmId === l.id ? "Confirm 🚫" : "🚫 DNC"}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
