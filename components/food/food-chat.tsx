"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function FoodChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/food/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Hmm, let me think..." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong!" }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 90,
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f472b6, #c084fc)",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: "1.5rem",
          boxShadow: "0 4px 20px rgba(244, 114, 182, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        aria-label="Open kitchen assistant"
      >
        🍳
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 90,
        width: "380px",
        maxWidth: "calc(100vw - 2rem)",
        height: "500px",
        maxHeight: "calc(100vh - 3rem)",
        borderRadius: "1.25rem",
        background: "white",
        border: "1.5px solid rgba(244, 114, 182, 0.2)",
        boxShadow: "0 12px 40px rgba(74, 32, 64, 0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-fredoka), sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #f472b6, #c084fc)",
          padding: "0.875rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>🍳</span>
          <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Kitchen Assistant</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "50%",
            width: "28px",
            height: "28px",
            color: "white",
            cursor: "pointer",
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#9c6b8a" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👋</div>
            <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Hey! I&apos;m your kitchen helper.</p>
            <p style={{ fontSize: "0.8125rem" }}>
              Ask me anything — recipe ideas, substitutions, cooking tips, or &quot;what can I make with chicken and rice?&quot;
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "0.625rem 0.875rem",
              borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
              background: m.role === "user"
                ? "linear-gradient(135deg, #f472b6, #c084fc)"
                : "#fff0f5",
              color: m.role === "user" ? "white" : "#4a2040",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "0.625rem 0.875rem",
              borderRadius: "1rem 1rem 1rem 0.25rem",
              background: "#fff0f5",
              color: "#9c6b8a",
              fontSize: "0.875rem",
            }}
          >
            Thinking... 🧠
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid rgba(244, 114, 182, 0.15)", display: "flex", gap: "0.5rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask me anything..."
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: "0.75rem",
            border: "1.5px solid rgba(244, 114, 182, 0.2)",
            outline: "none",
            fontSize: "0.875rem",
            fontFamily: "var(--font-fredoka), sans-serif",
            color: "#4a2040",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: "0.5rem 0.875rem",
            borderRadius: "0.75rem",
            background: "linear-gradient(135deg, #f472b6, #c084fc)",
            color: "white",
            border: "none",
            cursor: loading ? "wait" : "pointer",
            fontSize: "0.875rem",
            fontFamily: "var(--font-fredoka), sans-serif",
            opacity: loading || !input.trim() ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
