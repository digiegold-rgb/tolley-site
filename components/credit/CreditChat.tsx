"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function CreditChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setExpanded(true);
    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/credit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: newMessages.slice(-10),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response || data.error || "No response" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to reach the advisor." },
      ]);
    }
    setLoading(false);
  };

  const suggestions = [
    "Where am I at?",
    "Am I HELOC-ready?",
    "What should I pay this week?",
    "What's dragging my score down?",
  ];

  return (
    <div className="rounded-2xl border border-purple-400/25 bg-[linear-gradient(160deg,rgba(129,75,229,0.12),rgba(56,20,122,0.08)),rgba(8,7,15,0.65)] p-4 shadow-lg backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
        <span className="text-xs font-medium tracking-wider text-white/65 uppercase">
          Credit Advisor AI
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              setExpanded(false);
            }}
            className="ml-auto text-xs text-white/40 hover:text-white/60"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      {expanded && messages.length > 0 && (
        <div
          ref={scrollRef}
          className="mb-3 max-h-64 space-y-2 overflow-y-auto scrollbar-thin"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-8 bg-purple-500/20 text-white/90"
                  : "mr-8 bg-white/8 text-white/80"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {loading && (
            <div className="mr-8 rounded-xl bg-white/8 px-3 py-2 text-sm text-white/50">
              Thinking...
            </div>
          )}
        </div>
      )}

      {/* Quick suggestions */}
      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setInput(s);
                setTimeout(() => {
                  const syntheticInput = s;
                  setInput("");
                  setExpanded(true);
                  const newMessages: Message[] = [{ role: "user", content: syntheticInput }];
                  setMessages(newMessages);
                  setLoading(true);
                  fetch("/api/credit/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: syntheticInput, history: [] }),
                  })
                    .then((r) => r.json())
                    .then((data) =>
                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "assistant",
                          content: data.response || "No response",
                        },
                      ])
                    )
                    .catch(() =>
                      setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: "Failed to connect." },
                      ])
                    )
                    .finally(() => setLoading(false));
                }, 0);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white/80"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about your credit..."
          className="flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white/90 placeholder-white/30 outline-none focus:border-purple-400/40 focus:bg-white/8"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-purple-500/30 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-purple-500/40 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
