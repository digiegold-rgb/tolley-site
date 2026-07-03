"use client";

import { useEffect, useRef, useState } from "react";
import { useCommandPalette } from "@/components/ui/CommandPalette";
import { useToast } from "@/components/ui/Toast";

/**
 * T-Agent AI co-pilot. Real chat UI backed by /api/leads/copilot/chat, which
 * forwards to vLLM on DGX Spark with live grounding from the subscriber's
 * farm data. The command palette is still reachable via Cmd+K or the "/"
 * shortcut for direct command execution.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What should I focus on today?",
  "Draft an SMS for my top hot lead",
  "Which listing should I CMA next?",
  "Explain how lead scoring works",
];

// localStorage key — persists chat across tab switches and page reloads.
// Keep this versioned so a future schema change can invalidate old blobs.
const STORAGE_KEY = "tagent:copilot:chat:v1";
const STORAGE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface PersistedChat {
  savedAt: number;
  messages: ChatMessage[];
}

function loadPersistedChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedChat;
    if (!parsed || typeof parsed.savedAt !== "number") return [];
    if (Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    if (!Array.isArray(parsed.messages)) return [];
    return parsed.messages.filter(
      (m): m is ChatMessage =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string"
    );
  } catch {
    // Corrupt blob — nuke it so we don't keep hitting this path.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage unavailable (private mode) */
    }
    return [];
  }
}

function savePersistedChat(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: PersistedChat = { savedAt: Date.now(), messages };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota or private mode — drop silently */
  }
}

export default function AiChatPane() {
  const palette = useCommandPalette();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate chat from localStorage on mount (client-only) so switching tabs
  // or reloading the cockpit doesn't wipe the conversation.
  useEffect(() => {
    setMessages(loadPersistedChat());
    setHydrated(true);
  }, []);

  // Persist every change once we've hydrated (avoid clobbering stored chat
  // with the empty initial state during SSR/first paint).
  useEffect(() => {
    if (!hydrated) return;
    savePersistedChat(messages);
  }, [messages, hydrated]);

  // Cross-tab sync — if you open /leads in another tab, both stay in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setMessages(loadPersistedChat());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Autoscroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Slash-prefix escapes straight to the command palette (power-user path)
    if (trimmed.startsWith("/")) {
      palette.open(trimmed.slice(1));
      setValue("");
      return;
    }

    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextHistory);
    // Commit user message to storage immediately so switching tabs mid-send
    // doesn't lose the prompt.
    savePersistedChat(nextHistory);
    setValue("");
    setSending(true);

    // Helper: append a message *both* in state and directly in localStorage.
    // The direct-write path matters because if the user switches tabs this
    // component unmounts — setMessages would no-op, but the localStorage
    // write still lands, and the next mount rehydrates it.
    const appendMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        savePersistedChat(next);
        return next;
      });
      // Fallback: also read the latest blob and append in case setMessages
      // was a no-op due to unmount.
      const latest = loadPersistedChat();
      const alreadyHas =
        latest.length > 0 &&
        latest[latest.length - 1].role === msg.role &&
        latest[latest.length - 1].content === msg.content;
      if (!alreadyHas) {
        savePersistedChat([...latest, msg]);
      }
    };

    try {
      const res = await fetch("/api/leads/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; error?: string; detail?: string }
        | null;

      if (!res.ok || !data?.message) {
        const errMsg =
          data?.detail ?? data?.error ?? `Server returned ${res.status}`;
        toast({
          title: "Co-pilot error",
          description: errMsg,
          variant: "error",
        });
        appendMessage({
          role: "assistant",
          content: `Sorry — I couldn't reach the model. (${errMsg})`,
        });
        return;
      }

      appendMessage({ role: "assistant", content: data.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      toast({
        title: "Network error",
        description: msg,
        variant: "error",
      });
      appendMessage({
        role: "assistant",
        content: `Network error: ${msg}`,
      });
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setValue("");
    savePersistedChat([]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void send(value);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 p-5 shadow-2xl shadow-violet-500/10">
      {/* Vibrant gradient hero — fresh pops of color */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, rgba(167,139,250,0.22) 0%, rgba(244,114,182,0.18) 35%, rgba(56,189,248,0.22) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 100% at 100% 0%, rgba(94,234,212,0.15) 0%, transparent 60%)",
        }}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-lg shadow-violet-500/40">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m12 3-1.5 4L6 9l4.5 2L12 15l1.5-4L18 9l-4.5-2Z" />
              <path d="M5 17v4M3 19h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">AI co-pilot</h2>
            <p className="text-[11px] text-white/70">
              Grounded in your live farm data · type{" "}
              <code className="rounded bg-white/15 px-1 text-[10px]">/</code>{" "}
              for commands
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] text-white/80 hover:border-white/40 hover:bg-white/20 hover:text-white"
          >
            New chat
          </button>
        )}
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="mb-3 max-h-[280px] space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-black/20 p-3 backdrop-blur-sm"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-violet-500/70 to-fuchsia-500/70 text-white shadow-md shadow-fuchsia-500/20"
                    : "bg-white/10 text-white/90 backdrop-blur-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/10 px-3 py-2 text-[13px] text-white/70 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300" />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          disabled={sending}
          placeholder={
            messages.length === 0
              ? 'Try: "What should I focus on today?"'
              : "Reply…"
          }
          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 pr-20 text-sm text-white placeholder:text-white/50 backdrop-blur-sm transition-colors focus:border-fuchsia-300/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30 disabled:opacity-60"
        />
        <button
          onClick={() => void send(value)}
          disabled={sending || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-br from-violet-400 to-fuchsia-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-500/40 transition-all hover:shadow-lg hover:shadow-fuchsia-500/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>

      {/* Suggestion chips — only shown before the first message */}
      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/20 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
