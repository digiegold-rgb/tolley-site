"use client";

import { useState, useRef, useEffect } from "react";

// Inline SVG icons — no lucide dependency needed
const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);
const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
  </svg>
);
const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);
const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ServiceChatProps {
  topic: string;
  botName: string;
  placeholder?: string;
  suggestedQuestions?: string[];
  gradientFrom: string;
  gradientTo: string;
  accentText: string;
  borderAccent: string;
  bgAccent: string;
  btnClass: string;
  lightMode?: boolean;
}

export function ServiceChat({
  topic,
  botName,
  placeholder = "Ask a question...",
  suggestedQuestions = [],
  gradientFrom,
  gradientTo,
  accentText,
  borderAccent,
  bgAccent,
  btnClass,
  lightMode = false,
}: ServiceChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history: updated.slice(-6), topic }),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.error || data.reply }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const textPrimary = lightMode ? "text-gray-800" : "text-white";
  const textSecondary = lightMode ? "text-gray-600" : "text-gray-400";
  const textMuted = lightMode ? "text-gray-500" : "text-gray-500";
  const panelBg = lightMode ? "bg-white/95" : "bg-gray-900/95";
  const panelBorder = lightMode ? "border-gray-200" : "border-white/10";
  const headerBg = lightMode ? "bg-gray-50/80" : "bg-white/5";
  const inputBg = lightMode ? "bg-gray-50/50" : "bg-white/[0.02]";
  const sugBg = lightMode ? "bg-gray-100 hover:bg-gray-200 border-gray-200" : "bg-white/5 hover:bg-white/10 border-white/10";
  const barBg = lightMode ? "bg-white/80 border-gray-200 hover:bg-white hover:border-gray-300" : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-opacity-50";

  if (!open) {
    return (
      <div className="px-5 sm:px-8 pb-2 -mt-4 relative z-20">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => setOpen(true)}
            className={`w-full flex items-center gap-3 rounded-2xl border backdrop-blur-xl px-5 py-3.5 text-left transition-all group shadow-lg ${barBg}`}
          >
            <div className={`flex-shrink-0 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} p-2`}>
              <ChatIcon className="w-4 h-4 text-white" />
            </div>
            <span className={`${textSecondary} transition-colors flex-1 text-sm`}>
              {placeholder}
            </span>
            <span className={`text-[10px] ${accentText} font-medium hidden sm:block`}>AI</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 pb-6 -mt-4 relative z-20">
      <div className="mx-auto max-w-2xl">
        <div className={`rounded-2xl border ${borderAccent} ${panelBg} backdrop-blur-xl shadow-2xl overflow-hidden`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-3 border-b ${panelBorder} ${headerBg}`}>
            <div className="flex items-center gap-2">
              <div className={`rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} p-1.5`}>
                <BotIcon className="w-4 h-4 text-white" />
              </div>
              <span className={`text-sm font-semibold ${textPrimary}`}>{botName}</span>
              <span className={`text-[10px] ${textMuted} ${lightMode ? "bg-gray-100" : "bg-white/5"} rounded px-1.5 py-0.5`}>AI</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className={`rounded-lg p-1.5 ${textSecondary} ${lightMode ? "hover:bg-gray-100" : "hover:bg-white/10"} transition-colors`}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="h-64 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} p-1.5 mt-0.5`}>
                    <BotIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className={`text-sm ${textSecondary} leading-relaxed`}>
                    Hey! Ask me anything about our services, pricing, or availability.
                  </p>
                </div>
                {suggestedQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className={`text-xs rounded-lg border px-3 py-1.5 ${sugBg} ${textSecondary} transition-all`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 rounded-lg p-1.5 mt-0.5 ${
                    msg.role === "assistant"
                      ? `bg-gradient-to-br ${gradientFrom} ${gradientTo}`
                      : lightMode ? "bg-gray-200" : "bg-white/10"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <BotIcon className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <UserIcon className={`w-3.5 h-3.5 ${lightMode ? "text-gray-500" : "text-gray-400"}`} />
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${msg.role === "assistant" ? textSecondary : textPrimary}`}>
                  {msg.content}
                </p>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} p-1.5 mt-0.5`}>
                  <BotIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <SpinnerIcon className={`w-3.5 h-3.5 ${accentText} animate-spin`} />
                  <span className={`text-xs ${textMuted}`}>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className={`flex items-center gap-2 px-4 py-3 border-t ${panelBorder} ${inputBg}`}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              maxLength={1000}
              disabled={loading}
              className={`flex-1 bg-transparent text-sm ${textPrimary} ${lightMode ? "placeholder-gray-400" : "placeholder-gray-500"} outline-none disabled:opacity-50`}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`rounded-lg ${btnClass} p-2 disabled:opacity-30 transition-all`}
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
