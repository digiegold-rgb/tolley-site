"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  model?: string;
  durationMs?: number;
  timestamp: number;
}

export default function AgentChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/trading/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            text: `Error: ${data.error || "Unknown error"}`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: data.text,
          model: data.model,
          durationMs: data.durationMs,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: `Connection error: ${err instanceof Error ? err.message : "unknown"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="crypto-card group cursor-pointer transition-all hover:border-amber-500/30 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg">
          {"\uD83E\uDD1E"}
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">
            Digital Gold Agent
          </h3>
          <p className="text-[10px] text-white/30">
            Chat with crypto-oracle via OpenClaw
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
          Chat
        </span>
      </button>
    );
  }

  return (
    <div className="crypto-card border-amber-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-sm">
            {"\uD83E\uDD1E"}
          </div>
          <div>
            <h3 className="text-sm font-medium text-amber-400">
              Digital Gold Agent
            </h3>
            <span className="text-[10px] text-white/30">
              crypto-oracle &middot; OpenClaw
            </span>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-white/30 hover:text-white/60 transition-colors text-xs px-2 py-1 rounded hover:bg-white/5"
        >
          Minimize
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto py-3 space-y-3 scrollbar-thin"
      >
        {messages.length === 0 && (
          <div className="text-center text-white/20 text-xs py-12">
            Send a message to Digital Gold
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-amber-500/20 text-amber-100 border border-amber-500/20"
                  : "bg-white/[0.04] text-white/80 border border-white/5"
              }`}
            >
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {msg.text}
              </div>
              {msg.role === "agent" && msg.durationMs && (
                <div className="mt-1 text-[10px] text-white/20">
                  {(msg.durationMs / 1000).toFixed(1)}s
                  {msg.model ? ` \u00B7 ${msg.model.split("/").pop()}` : ""}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/5 rounded-xl px-3 py-2 text-sm text-white/40">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">.</span>
                <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-white/5">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Digital Gold..."
            rows={1}
            disabled={sending}
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder-white/20 outline-none resize-none transition focus:border-amber-500/40 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-400 uppercase tracking-wider transition hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
