"use client";

import { useState, useRef, useEffect } from "react";
import type { WaterReading } from "@/lib/water";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  latestReading: WaterReading | null;
}

const QUICK_ACTIONS = [
  { label: "Full Analysis", message: "Analyze my current pool water readings. What should I do? Prioritize the most important actions." },
  { label: "What to Add?", message: "Based on my current readings, what chemicals do I need to add and how much? Give me exact amounts for my 48,000 gallon pool." },
  { label: "Pre-Storm Prep", message: "Rain/storms are coming. How should I prepare my pool? What should I do before and after the storm?" },
  { label: "Season Opener", message: "I'm opening my pool for the season. Give me a complete startup checklist with chemical amounts for my 48,000 gallon saltwater pool." },
];

export function WaterAdvisor({ latestReading }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/water/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reading: latestReading,
          message: text.trim(),
          history: newMessages.slice(-10),
        }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages([...newMessages, { role: "assistant", content: data.response }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: data.error || "Advisor unavailable." }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Failed to reach advisor." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="water-card flex flex-col" style={{ minHeight: 320 }}>
      <h3
        className="mb-3 uppercase text-white/50"
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: "0.6rem",
          letterSpacing: "0.16em",
        }}
      >
        AI Pool Advisor
      </h3>

      {/* Suggestion chips — per handoff spec */}
      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.label}
              onClick={() => sendMessage(qa.message)}
              className="rounded-full border border-[rgba(0,229,199,0.12)] bg-[rgba(0,229,199,0.1)] px-3 py-1.5 text-xs text-[#00e5c7] transition hover:bg-[rgba(0,229,199,0.18)]"
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 300 }}>
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="ml-8 rounded-2xl border border-[rgba(0,229,199,0.18)] bg-[rgba(0,229,199,0.1)] px-4 py-3 text-sm leading-relaxed text-[#00e5c7]"
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div
              key={i}
              className="mr-4 rounded-2xl border border-[rgba(0,229,199,0.12)] bg-[rgba(10,20,30,0.75)] p-4 text-sm leading-relaxed text-white/85"
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          )
        )}
        {loading && (
          <div className="mr-4 rounded-2xl border border-[rgba(0,229,199,0.12)] bg-[rgba(10,20,30,0.75)] p-4 text-sm text-white/40">
            Analyzing...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask about your pool..."
          className="water-input flex-1"
          disabled={loading}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="water-btn water-btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  );
}
