"use client";

import { useState, useEffect, useCallback } from "react";
import type { WdClientData } from "./wd-client-row";

interface WdMessage {
  id: string;
  clientId: string | null;
  channel: string;
  direction: string;
  kind: string;
  status: string;
  subject: string | null;
  body: string;
  aiGenerated: boolean;
  createdAt: string;
  client: { id: string; name: string; phone: string | null; email: string | null } | null;
}

interface Props {
  clients: WdClientData[];
  onChanged: () => void;
}

const KIND_LABEL: Record<string, string> = {
  reminder: "Renewal reminder",
  dunning: "Payment failed",
  approval: "Welcome",
  ai_reply: "AI reply",
  inbound: "Customer text",
};
const KIND_COLOR: Record<string, string> = {
  reminder: "#0d6efd",
  dunning: "#c0392b",
  approval: "#16a34a",
  ai_reply: "#7c3aed",
  inbound: "#555",
};

export function WdAutomationPanel({ clients, onChanged }: Props) {
  const [messages, setMessages] = useState<WdMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = clients.filter((c) => c.pendingApproval);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/wd/messages?status=draft");
      if (r.ok) {
        const d = await r.json();
        setMessages(d.messages);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const r = await fetch("/api/wd/sync", { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setSyncMsg(`Synced ${d.subsSynced} subscriptions, ${d.invoicesRecorded} payments.`);
        onChanged();
        loadMessages();
      } else {
        setSyncMsg(d.error || "Sync failed");
      }
    } catch {
      setSyncMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function approve(clientId: string) {
    setBusyId(clientId);
    try {
      await fetch(`/api/wd/clients/${clientId}/approve`, { method: "POST" });
      onChanged();
      loadMessages();
    } finally {
      setBusyId(null);
    }
  }

  async function sendMsg(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/wd/messages/${id}`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Send failed: ${d.error || "unknown"}`);
      }
      await loadMessages();
    } finally {
      setBusyId(null);
    }
  }

  async function skipMsg(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/wd/messages/${id}`, { method: "DELETE" });
      await loadMessages();
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/wd/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      setEditId(null);
      await loadMessages();
    } finally {
      setBusyId(null);
    }
  }

  const box: React.CSSProperties = {
    border: "1px solid #e6e8eb",
    borderRadius: 8,
    background: "#fff",
    padding: 14,
    marginBottom: 16,
  };

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Sync bar */}
      <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Stripe automation</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            Pull live subscriptions + payment history from Stripe into this dashboard.
          </div>
          {syncMsg && <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{syncMsg}</div>}
        </div>
        <button className="btn btn-sm btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing…" : "↻ Sync from Stripe"}
        </button>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div style={{ ...box, borderColor: "#fcd34d", background: "#fffbeb" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            🔔 {pending.length} new signup{pending.length > 1 ? "s" : ""} awaiting approval
          </div>
          {pending.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #fde68a", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13 }}>
                <strong>{c.name}</strong>
                <span style={{ color: "#777" }}> · {c.email || c.phone || "no contact"} · {c.subscriptionStatus || "—"}</span>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => approve(c.id)} disabled={busyId === c.id}>
                {busyId === c.id ? "…" : "✓ Approve & welcome"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Message drafts */}
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Message drafts {messages.length > 0 && <span style={{ color: "#0d6efd" }}>({messages.length})</span>}
          </div>
          <button className="btn btn-sm" onClick={loadMessages} disabled={loading} style={{ fontSize: 12 }}>
            {loading ? "…" : "Refresh"}
          </button>
        </div>
        {messages.length === 0 && (
          <div style={{ fontSize: 13, color: "#999", padding: "8px 0" }}>
            No drafts waiting. Reminders, failed-payment outreach, and AI replies to customer texts appear here for 1-tap send.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ borderTop: "1px solid #eef0f2", padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: KIND_COLOR[m.kind] || "#555", padding: "2px 7px", borderRadius: 10 }}>
                {KIND_LABEL[m.kind] || m.kind}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{m.client?.name || "—"}</span>
              <span style={{ fontSize: 11, color: "#999" }}>
                {m.channel === "email" ? "✉ email" : "💬 sms"}
                {m.aiGenerated ? " · AI" : ""}
                {m.status === "failed" ? " · ⚠ failed last send" : ""}
              </span>
            </div>
            {editId === m.id ? (
              <div>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  style={{ width: "100%", fontSize: 13, padding: 6, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}
                />
                <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => saveEdit(m.id)} disabled={busyId === m.id}>Save</button>
                  <button className="btn btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {m.subject && <div style={{ fontSize: 12, fontWeight: 600, color: "#444" }}>{m.subject}</div>}
                <div style={{ fontSize: 13, color: "#333", whiteSpace: "pre-wrap", marginBottom: 6 }}>{m.body}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => sendMsg(m.id)} disabled={busyId === m.id}>
                    {busyId === m.id ? "…" : "Send"}
                  </button>
                  <button className="btn btn-sm" onClick={() => { setEditId(m.id); setEditBody(m.body); }}>Edit</button>
                  <button className="btn btn-sm" onClick={() => skipMsg(m.id)} disabled={busyId === m.id} style={{ color: "#c0392b" }}>Skip</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
