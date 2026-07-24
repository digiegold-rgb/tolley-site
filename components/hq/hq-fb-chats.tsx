"use client";

import { useCallback, useEffect, useState } from "react";

interface ChatRow {
  id: string;
  page: string;
  at: string;
  message: string;
  reply: string | null;
  kind: "faq" | "ack" | "notify" | "fail";
  userId: string;
  conversationId: string | null;
}

const KIND_LABEL: Record<ChatRow["kind"], { label: string; color: string }> = {
  faq: { label: "FAQ answered", color: "#2dd4a7" },
  ack: { label: "Acknowledged", color: "#38bdf8" },
  notify: { label: "Needs Jared", color: "#fbbf24" },
  fail: { label: "Send FAILED", color: "#f87171" },
};

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

export function HqFbChats() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/fb-chats?limit=150");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { chats: ChatRow[] };
      setChats(j.chats ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>🤖 FB Messenger — bot conversations</h2>
        <button className="tab-btn" onClick={() => { setLoading(true); load(); }}>
          {loading ? "…" : "Refresh"}
        </button>
        <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>
          Every customer message the auto-reply bot handles, newest first. Auto-refreshes each minute.
        </span>
      </div>
      {error && <div style={{ color: "#f87171" }}>Failed to load: {error}</div>}
      {!loading && !error && chats.length === 0 && (
        <div style={{ opacity: 0.7 }}>
          No bot-handled messages yet. When someone messages any page (or taps a chat FAQ button),
          the conversation shows up here within a couple of minutes.
        </div>
      )}
      {chats.map((c) => {
        const k = KIND_LABEL[c.kind] ?? KIND_LABEL.notify;
        return (
          <div
            key={c.id}
            style={{
              border: "1px solid rgba(148,163,184,0.25)",
              borderLeft: `3px solid ${k.color}`,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong>{c.page}</strong>
              <span style={{ color: k.color, fontSize: "0.78rem", fontWeight: 600 }}>{k.label}</span>
              <span style={{ opacity: 0.55, fontSize: "0.78rem" }}>{ago(c.at)}</span>
            </div>
            <div style={{ fontSize: "0.92rem" }}>
              <span style={{ opacity: 0.6 }}>Customer:</span> {c.message}
            </div>
            {c.reply && (
              <div style={{ fontSize: "0.92rem" }}>
                <span style={{ opacity: 0.6 }}>Bot:</span> {c.reply}
              </div>
            )}
            {c.kind === "notify" && (
              <div style={{ fontSize: "0.8rem", color: "#fbbf24" }}>
                Bot stayed quiet (ack already sent recently) — answer this one in the Business Suite inbox.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
