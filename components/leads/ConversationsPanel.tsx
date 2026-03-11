"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SmsMsg {
  id: string;
  direction: string;
  body: string;
  status: string;
  mediaUrls: string[];
  createdAt: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  leadId: string | null;
  subscriberId: string | null;
  messages: SmsMsg[];
}

interface Props {
  conversations: Conversation[];
  syncKey: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-400",
  paused: "bg-yellow-400",
  opted_out: "bg-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  opted_out: "Opted out",
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const time = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) return `Yesterday ${time}`;

  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ConversationsPanel({ conversations, syncKey }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullThread, setFullThread] = useState<SmsMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when thread loads
  useEffect(() => {
    if (fullThread.length > 0 && threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [fullThread]);

  const loadThread = useCallback(
    async (convoId: string) => {
      setSelectedId(convoId);
      setMobileView("thread");
      setLoading(true);
      try {
        const res = await fetch("/api/sms/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": syncKey,
          },
          body: JSON.stringify({ conversationId: convoId }),
        });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setFullThread(data.conversation?.messages || []);
      } catch {
        setFullThread([]);
      } finally {
        setLoading(false);
      }
    },
    [syncKey]
  );

  function goBackToList() {
    setMobileView("list");
  }

  const filtered =
    statusFilter === "all"
      ? conversations
      : conversations.filter((c) => c.status === statusFilter);

  const selectedConvo = conversations.find((c) => c.id === selectedId);

  /* ---------------------------------------------------------------- */
  /*  Conversation list item                                           */
  /* ---------------------------------------------------------------- */

  function ConvoItem({ c }: { c: Conversation }) {
    const lastMsg = c.messages[0];
    const isSelected = selectedId === c.id;

    return (
      <button
        onClick={() => loadThread(c.id)}
        className={`w-full text-left rounded-xl p-3.5 transition-colors ${
          isSelected
            ? "bg-purple-500/15 border border-purple-500/30"
            : "bg-white/[0.03] border border-white/10 hover:bg-white/[0.06]"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                STATUS_DOT[c.status] || "bg-white/30"
              }`}
            />
            <span className="text-sm font-medium text-white">
              {formatPhone(c.phoneNumber)}
            </span>
          </div>
          <span className="text-[0.65rem] text-white/30 shrink-0 ml-2">
            {c.lastMessageAt ? timeAgo(c.lastMessageAt) : "new"}
          </span>
        </div>

        {lastMsg && (
          <p className="text-xs text-white/40 truncate pl-4">
            {lastMsg.direction === "outbound" ? "AI: " : ""}
            {lastMsg.body}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5 pl-4">
          <span className="text-[0.6rem] text-white/20">
            {c.messageCount} {c.messageCount === 1 ? "msg" : "msgs"}
          </span>
          {c.leadId && (
            <span className="text-[0.6rem] text-purple-400/50">lead linked</span>
          )}
          <span className="text-[0.6rem] text-white/15 capitalize">
            {c.status.replace("_", " ")}
          </span>
        </div>
      </button>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Message bubble                                                   */
  /* ---------------------------------------------------------------- */

  function MessageBubble({ msg }: { msg: SmsMsg }) {
    const isOutbound = msg.direction === "outbound";

    return (
      <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
            isOutbound
              ? "bg-purple-500/20 border border-purple-500/20"
              : "bg-white/[0.08] border border-white/10"
          }`}
        >
          <p
            className={`text-sm leading-relaxed ${
              isOutbound ? "text-purple-100" : "text-white/80"
            }`}
          >
            {msg.body}
          </p>

          {msg.mediaUrls && msg.mediaUrls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {msg.mediaUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                >
                  [media {i + 1}]
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[0.6rem] text-white/25">
              {formatTimestamp(msg.createdAt)}
            </span>
            {msg.status === "failed" && (
              <span className="text-[0.6rem] text-red-400 font-medium">
                failed
              </span>
            )}
            {msg.status === "delivered" && isOutbound && (
              <span className="text-[0.6rem] text-white/20">delivered</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[400px]">
      {/* ---- Left: conversation list ---- */}
      <div
        className={`w-full md:w-[380px] md:shrink-0 flex flex-col ${
          mobileView === "thread" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Status filter tabs */}
        <div className="flex gap-1.5 mb-3">
          {["all", "active", "paused", "opted_out"].map((s) => {
            const count =
              s === "all"
                ? conversations.length
                : conversations.filter((c) => c.status === s).length;
            if (s !== "all" && count === 0) return null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-white/40 hover:text-white/60"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABEL[s] || s} ({count})
              </button>
            );
          })}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {filtered.map((c) => (
            <ConvoItem key={c.id} c={c} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-white/25 text-sm">
              {conversations.length === 0
                ? "No conversations yet. SMS threads will appear here when contacts text your T-Agent number."
                : "No conversations match this filter."}
            </div>
          )}
        </div>
      </div>

      {/* ---- Right: message thread ---- */}
      <div
        className={`flex-1 flex flex-col rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Thread header */}
        {selectedConvo && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            {/* Mobile back button */}
            <button
              onClick={goBackToList}
              className="md:hidden text-white/50 hover:text-white/80 text-sm"
            >
              &larr; Back
            </button>

            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                STATUS_DOT[selectedConvo.status] || "bg-white/30"
              }`}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white">
                {formatPhone(selectedConvo.phoneNumber)}
              </span>
              <span className="ml-2 text-xs text-white/30 capitalize">
                {selectedConvo.status.replace("_", " ")}
              </span>
            </div>
            <span className="text-xs text-white/25">
              {selectedConvo.messageCount}{" "}
              {selectedConvo.messageCount === 1 ? "message" : "messages"}
            </span>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!selectedId && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-white/15 text-4xl mb-3">SMS</div>
                <p className="text-white/25 text-sm">
                  Select a conversation to view messages
                </p>
              </div>
            </div>
          )}

          {selectedId && loading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-white/30 text-sm">
                <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                Loading messages...
              </div>
            </div>
          )}

          {selectedId && !loading && fullThread.length > 0 && (
            <div className="space-y-3">
              {fullThread.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={threadEndRef} />
            </div>
          )}

          {selectedId && !loading && fullThread.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/20 text-sm">
                No messages in this conversation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
