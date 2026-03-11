"use client";

import { useState } from "react";

interface SmsMsg {
  id: string;
  direction: string;
  body: string;
  status: string;
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

export default function SmsInbox({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [fullThread, setFullThread] = useState<SmsMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const syncKey =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("key") || ""
      : "";

  async function loadThread(convoId: string) {
    setSelected(convoId);
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
      const data = await res.json();
      setFullThread(data.conversation?.messages || []);
    } catch {
      setFullThread([]);
    } finally {
      setLoading(false);
    }
  }

  function formatPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const STATUS_DOT: Record<string, string> = {
    active: "bg-green-400",
    opted_out: "bg-red-400",
    paused: "bg-yellow-400",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Conversation list */}
      <div className="space-y-2 max-h-[70vh] overflow-y-auto">
        {conversations.map((c) => {
          const lastMsg = c.messages[0];
          const isSelected = selected === c.id;

          return (
            <button
              key={c.id}
              onClick={() => loadThread(c.id)}
              className={`w-full text-left rounded-lg p-3 transition-colors ${
                isSelected
                  ? "bg-purple-500/20 border border-purple-500/40"
                  : "bg-white/[0.03] border border-white/10 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${STATUS_DOT[c.status] || "bg-white/30"}`}
                  />
                  <span className="text-sm font-medium text-white">
                    {formatPhone(c.phoneNumber)}
                  </span>
                </div>
                <span className="text-[0.65rem] text-white/30">
                  {c.lastMessageAt ? timeAgo(c.lastMessageAt) : "new"}
                </span>
              </div>
              {lastMsg && (
                <p className="text-xs text-white/40 truncate">
                  {lastMsg.direction === "outbound" ? "You: " : ""}
                  {lastMsg.body}
                </p>
              )}
              <div className="flex gap-2 mt-1 text-[0.6rem] text-white/20">
                <span>{c.messageCount} msgs</span>
                {c.leadId && <span>lead linked</span>}
              </div>
            </button>
          );
        })}

        {conversations.length === 0 && (
          <div className="text-center py-8 text-white/30 text-sm">
            No conversations yet. SMS will appear here when people text your
            T-Agent number.
          </div>
        )}
      </div>

      {/* Message thread */}
      <div className="rounded-xl bg-white/[0.02] border border-white/10 p-4 max-h-[70vh] overflow-y-auto">
        {!selected && (
          <div className="flex items-center justify-center h-full text-white/20 text-sm">
            Select a conversation
          </div>
        )}

        {selected && loading && (
          <div className="flex items-center justify-center h-full text-white/30 text-sm">
            Loading...
          </div>
        )}

        {selected && !loading && (
          <div className="space-y-3">
            {fullThread.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.direction === "outbound"
                      ? "bg-purple-500/20 text-purple-100"
                      : "bg-white/10 text-white/80"
                  }`}
                >
                  <p>{msg.body}</p>
                  <div className="flex items-center gap-2 mt-1 text-[0.6rem] text-white/30">
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {msg.status === "failed" && (
                      <span className="text-red-400">failed</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {fullThread.length === 0 && (
              <div className="text-center py-8 text-white/20 text-sm">
                No messages in this thread
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
