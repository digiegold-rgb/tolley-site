"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { withSmsDayDividers } from "@/lib/hq-sms-day";
import { readApiError } from "./types";

type InboxSource = "wd" | "tagent" | "unmatched";

interface SmsThread {
  phoneKey: string;
  displayPhone: string;
  e164: string | null;
  name: string | null;
  source: InboxSource;
  clientId: string | null;
  lastBody: string;
  lastAt: string;
  lastDirection: "inbound" | "outbound";
  unread: boolean;
  needsSend: boolean;
  draftId: string | null;
  draftBody: string | null;
  messageCount: number;
  optedOut: boolean;
}

interface SmsMsg {
  id: string;
  table: "wd" | "sms";
  direction: "inbound" | "outbound";
  kind: string;
  status: string;
  body: string;
  aiGenerated: boolean;
  createdAt: string;
  sentAt: string | null;
  sendable: boolean;
}

const SOURCE_LABEL: Record<InboxSource, string> = {
  wd: "W/D",
  tagent: "T-Agent",
  unmatched: "Unknown",
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HqSmsInbox({ onCounts }: { onCounts?: (needsSend: number) => void }) {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "needs" | "unread">("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(searchParams.get("phone"));
  const [messages, setMessages] = useState<SmsMsg[]>([]);
  const [thread, setThread] = useState<SmsThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const r = await fetch("/api/hq/sms");
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load SMS"));
      const d = (await r.json()) as { threads: SmsThread[]; counts: { needsSend: number } };
      setThreads(d.threads);
      onCounts?.(d.counts.needsSend);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SMS");
    } finally {
      setLoading(false);
    }
  }, [onCounts]);

  const loadThread = useCallback(async (phoneKey: string) => {
    setSelectedKey(phoneKey);
    setMobileView("thread");
    setThreadLoading(true);
    setActionError("");
    try {
      const r = await fetch(`/api/hq/sms/${encodeURIComponent(phoneKey)}`);
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load thread"));
      const d = (await r.json()) as { thread: SmsThread | null; messages: SmsMsg[] };
      setThread(d.thread);
      setMessages(d.messages);
      const pending = [...d.messages].reverse().find((m) => m.sendable);
      setDraftId(pending?.id ?? null);
      setDraftText(pending?.body ?? "");
      window.history.replaceState(null, "", `/hq?tab=sms&phone=${phoneKey}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load thread");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
    const t = setInterval(() => void loadThreads(), 30_000);
    return () => clearInterval(t);
  }, [loadThreads]);

  useEffect(() => {
    const phone = searchParams.get("phone");
    if (phone) void loadThread(phone);
  }, [searchParams, loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, threadLoading]);

  const filtered = threads.filter((t) => {
    if (filter === "needs") return t.needsSend;
    if (filter === "unread") return t.unread;
    return true;
  });

  async function saveDraft(id: string, body: string) {
    const r = await fetch(`/api/wd/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!r.ok) throw new Error(await readApiError(r, "Save failed"));
  }

  async function sendExisting(id: string) {
    const r = await fetch(`/api/wd/messages/${id}`, { method: "POST" });
    if (!r.ok) throw new Error(await readApiError(r, "Send failed"));
  }

  async function handleSend() {
    if (!selectedKey || !draftText.trim() || busy) return;
    setBusy(true);
    setActionError("");
    try {
      let id = draftId;
      if (id) {
        await saveDraft(id, draftText.trim());
      } else {
        const r = await fetch("/api/hq/sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: thread?.e164 || selectedKey,
            body: draftText.trim(),
            clientId: thread?.clientId,
          }),
        });
        if (!r.ok) throw new Error(await readApiError(r, "Draft failed"));
        const d = (await r.json()) as { id: string };
        id = d.id;
      }
      await sendExisting(id);
      setDraftId(null);
      setDraftText("");
      await Promise.all([loadThread(selectedKey), loadThreads()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedKey || !draftText.trim() || busy) return;
    setBusy(true);
    setActionError("");
    try {
      if (draftId) {
        await saveDraft(draftId, draftText.trim());
      } else {
        const r = await fetch("/api/hq/sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: thread?.e164 || selectedKey,
            body: draftText.trim(),
            clientId: thread?.clientId,
          }),
        });
        if (!r.ok) throw new Error(await readApiError(r, "Save failed"));
        const d = (await r.json()) as { id: string };
        setDraftId(d.id);
      }
      await Promise.all([loadThread(selectedKey), loadThreads()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    if (!draftId || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const r = await fetch(`/api/wd/messages/${draftId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await readApiError(r, "Skip failed"));
      setDraftId(null);
      setDraftText("");
      if (selectedKey) await Promise.all([loadThread(selectedKey), loadThreads()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Skip failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sms-inbox">
      <div className={`sms-list${mobileView === "thread" ? " sms-hide-mobile" : ""}`}>
        <div className="sms-list-head">
          <div>
            <div className="sms-title">SMS — 913-600-7508</div>
            <div className="sms-sub">Every text. Draft, then one tap to send. Nothing goes out on its own.</div>
          </div>
          <button className="btn btn-sm" onClick={() => { setLoading(true); void loadThreads(); }}>
            {loading ? "…" : "↻"}
          </button>
        </div>
        <div className="sms-filters">
          {(
            [
              ["all", "All"],
              ["needs", "Needs send"],
              ["unread", "Unread"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`sms-chip${filter === id ? " active" : ""}`}
              onClick={() => setFilter(id)}
            >
              {label}
              {id === "needs" && threads.some((t) => t.needsSend)
                ? ` (${threads.filter((t) => t.needsSend).length})`
                : ""}
            </button>
          ))}
        </div>
        <div className="sms-thread-list">
          {error && <div className="sms-empty" style={{ color: "var(--hq-red)" }}>{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="sms-empty">
              {threads.length === 0
                ? "No texts yet. When someone messages 913-600-7508 it shows up here."
                : "Nothing in this filter."}
            </div>
          )}
          {filtered.map((t) => (
            <button
              key={t.phoneKey}
              className={`sms-row${selectedKey === t.phoneKey ? " selected" : ""}`}
              onClick={() => void loadThread(t.phoneKey)}
            >
              <div className="sms-row-top">
                <span className="sms-name">{t.name || t.displayPhone}</span>
                <span className="sms-ago">{timeAgo(t.lastAt)}</span>
              </div>
              {t.name && <div className="sms-phone">{t.displayPhone}</div>}
              <div className="sms-preview">
                {t.lastDirection === "outbound" ? "You: " : ""}
                {t.lastBody}
              </div>
              <div className="sms-badges">
                <span className={`sms-badge src-${t.source}`}>{SOURCE_LABEL[t.source]}</span>
                {t.needsSend && <span className="sms-badge needs">Needs send</span>}
                {t.unread && <span className="sms-badge unread">Unread</span>}
                {t.optedOut && <span className="sms-badge stop">STOP</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={`sms-thread${mobileView === "list" ? " sms-hide-mobile" : ""}`}>
        {!selectedKey && (
          <div className="sms-empty tall">Select a conversation</div>
        )}
        {selectedKey && (
          <>
            <div className="sms-thread-head">
              <button className="btn btn-sm sms-back" onClick={() => setMobileView("list")}>
                ← Threads
              </button>
              <div className="sms-thread-who">
                <strong>{thread?.name || thread?.displayPhone || selectedKey}</strong>
                {thread?.name && <span>{thread.displayPhone}</span>}
                {thread && (
                  <span className={`sms-badge src-${thread.source}`}>{SOURCE_LABEL[thread.source]}</span>
                )}
                {thread?.optedOut && <span className="sms-badge stop">STOP</span>}
              </div>
            </div>
            <div className="sms-msgs">
              {threadLoading && <div className="sms-empty">Loading…</div>}
              {!threadLoading &&
                withSmsDayDividers(messages.filter((m) => !m.sendable)).map(({ message: m, dayLabel }) => (
                  <Fragment key={m.id}>
                    {dayLabel && (
                      <div className="sms-day" role="separator" aria-label={dayLabel}>
                        <span className="sms-day-label">{dayLabel}</span>
                      </div>
                    )}
                    <div className={`sms-bubble ${m.direction}`}>
                      <div className="sms-bubble-body">{m.body}</div>
                      <div className="sms-bubble-meta">
                        {stamp(m.createdAt)}
                        {m.status === "failed" && <span className="fail"> failed</span>}
                        {m.aiGenerated && m.direction === "outbound" && <span> · AI</span>}
                      </div>
                    </div>
                  </Fragment>
                ))}
              <div ref={endRef} />
            </div>
            <div className="sms-compose">
              {thread?.optedOut && (
                <div className="sms-warn">This number opted out. Send is blocked.</div>
              )}
              {actionError && <div className="sms-warn">{actionError}</div>}
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                placeholder={draftId ? "Edit the AI draft, then Send." : "Type a reply…"}
                disabled={busy || thread?.optedOut}
              />
              <div className="sms-compose-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => void handleSend()}
                  disabled={busy || !draftText.trim() || thread?.optedOut}
                >
                  {busy ? "…" : "Send"}
                </button>
                <button className="btn" onClick={() => void handleSaveDraft()} disabled={busy || !draftText.trim()}>
                  Save draft
                </button>
                {draftId && (
                  <button className="btn" onClick={() => void handleSkip()} disabled={busy} style={{ color: "var(--hq-red)" }}>
                    Skip
                  </button>
                )}
                {draftId && <span className="sms-compose-hint">AI draft — tap Send when it looks right</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
