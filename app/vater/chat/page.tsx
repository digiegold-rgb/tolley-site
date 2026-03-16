"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function messageId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function VaterChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);

    const userMsg: Message = {
      id: messageId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch("/api/vater/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      const assistantMsg: Message = {
        id: messageId(),
        role: "assistant",
        content: data.reply || "No response.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Connection failed. Check your internet and try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="vater-chat-page">
      {/* Header */}
      <header className="vater-chat-header">
        <div className="vater-chat-header-inner">
          <div className="vater-chat-logo">
            <span className="vater-chat-logo-icon">✈️</span>
            <div>
              <h1 className="vater-chat-title">Vater AI</h1>
              <p className="vater-chat-subtitle">Your business copilot</p>
            </div>
          </div>
          <div className="vater-chat-status">
            <span className="vater-chat-dot" />
            Online
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="vater-chat-messages">
        {messages.length === 0 && (
          <div className="vater-chat-welcome">
            <span className="vater-chat-welcome-icon">🦞</span>
            <h2>Hey Vater!</h2>
            <p>
              I have access to your live business data — arbitrage pairs,
              margins, dashboards. Ask me anything about your ventures.
            </p>
            <div className="vater-chat-starters">
              {[
                "What arbitrage pairs are pending review?",
                "Show me my best profit opportunities",
                "How do I get started on SAM.gov?",
                "Write me a YouTube script about learning to fly",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="vater-chat-starter"
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`vater-chat-bubble ${
              msg.role === "user" ? "vater-chat-bubble-user" : "vater-chat-bubble-ai"
            }`}
          >
            <div className="vater-chat-bubble-label">
              {msg.role === "user" ? "You" : "Vater AI"}
            </div>
            <div className="vater-chat-bubble-content">
              {msg.content.split("\n").map((line, i) => (
                <p key={`${msg.id}-${i}`}>{line || "\u00A0"}</p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="vater-chat-bubble vater-chat-bubble-ai">
            <div className="vater-chat-bubble-label">Vater AI</div>
            <div className="vater-chat-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && (
          <div className="vater-chat-error">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="vater-chat-input-area">
        <div className="vater-chat-input-wrap">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="vater-chat-input"
            disabled={loading}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="vater-chat-send"
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="vater-chat-disclaimer">
          AI responses may not always be accurate. Verify important details.
        </p>
      </div>
    </div>
  );
}
