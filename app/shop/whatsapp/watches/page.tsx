"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Watch {
  id: string;
  chatId: string;
  chatName: string | null;
  groupMode: "smart" | "single" | "pairs";
  count: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  lastListed: number;
  totalListed: number;
  createdAt: string;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function WatchesPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [watches, setWatches] = useState<Watch[]>([]);
  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [groupMode, setGroupMode] = useState<"smart" | "single" | "pairs">("single");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/whatsapp/watches", { cache: "no-store" });
    if (res.ok) setWatches((await res.json()).watches);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/shop/auth");
      const ok = res.ok && (await res.json()).authenticated;
      setAuthed(!!ok);
      if (ok) void load();
    })();
  }, [load]);

  // Refresh stats every 10s while authed (watcher runs every ~2 min).
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [authed, load]);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/shop/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setAuthed(true);
      void load();
    } else setPinError("Wrong PIN");
  }

  async function addWatch() {
    setError("");
    if (chatId.trim().length < 5) {
      setError("Enter a phone number or WhatsApp chat ID.");
      return;
    }
    const res = await fetch("/api/shop/whatsapp/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: chatId.trim(),
        chatName: chatName.trim() || undefined,
        groupMode,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || d.error || "Failed to add");
      return;
    }
    setChatId("");
    setChatName("");
    void load();
  }

  async function toggle(w: Watch) {
    await fetch(`/api/shop/whatsapp/watches/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !w.enabled }),
    });
    void load();
  }

  async function remove(w: Watch) {
    if (!confirm(`Stop auto-listing and delete the watch for ${w.chatName || w.chatId}?`)) return;
    await fetch(`/api/shop/whatsapp/watches/${w.id}`, { method: "DELETE" });
    void load();
  }

  if (authed === null) {
    return <main className="min-h-screen bg-[#0b0b0f] text-white p-8">Loading…</main>;
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">
            Auto-watch <span className="text-green-400">sellers</span>
          </h1>
          <Link href="/shop/whatsapp" className="text-sm text-white/50 hover:text-white">
            ← One-off scan
          </Link>
        </div>

        {!authed && (
          <form onSubmit={submitPin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Admin PIN"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-green-400"
            />
            {pinError && <p className="text-red-300 text-sm">{pinError}</p>}
            <button className="w-full rounded-lg bg-green-500 hover:bg-green-400 text-black font-medium py-3">
              Unlock
            </button>
          </form>
        )}

        {authed && (
          <div className="space-y-6">
            <p className="text-white/60 text-sm leading-relaxed">
              A watched chat auto-lists every new photo it receives — its own product +
              Facebook draft, within a couple minutes, no clicking. Only photos sent{" "}
              <b className="text-white">after</b> you add the watch are listed.
            </p>

            {/* Add */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
              <div className="text-sm font-medium text-white/80">Add a seller</div>
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Phone (18165551234) or group ID (…@g.us)"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-green-400"
              />
              <input
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="Label (e.g. Mohammad — Crazy Bin Store #2)"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-green-400"
              />
              <div className="flex items-center gap-2">
                <select
                  value={groupMode}
                  onChange={(e) => setGroupMode(e.target.value as "smart" | "single" | "pairs")}
                  className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none"
                >
                  <option value="single">One listing per photo</option>
                  <option value="smart">Smart-group multi-angle</option>
                  <option value="pairs">Box(es) + Amazon screenshot</option>
                </select>
                <button
                  onClick={addWatch}
                  className="ml-auto rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 text-sm"
                >
                  Add watch
                </button>
              </div>
              {error && <p className="text-red-300 text-sm">{error}</p>}
            </div>

            {/* List */}
            <div className="space-y-2">
              {watches.length === 0 && (
                <p className="text-white/40 text-sm">No watched sellers yet.</p>
              )}
              {watches.map((w) => (
                <div
                  key={w.id}
                  className="rounded-lg bg-white/5 border border-white/10 p-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggle(w)}
                      title={w.enabled ? "Disable" : "Enable"}
                      className={`h-6 w-11 shrink-0 rounded-full transition ${
                        w.enabled ? "bg-green-500" : "bg-white/15"
                      }`}
                    >
                      <span
                        className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                          w.enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/90">
                        {w.chatName || w.chatId}
                      </p>
                      <p className="truncate text-xs text-white/40">
                        {w.chatId.replace(/@.*/, "")} ·{" "}
                        {w.groupMode === "single"
                          ? "1/photo"
                          : w.groupMode === "pairs"
                            ? "box+screenshot"
                            : "smart-group"}{" "}
                        ·{" "}
                        checked {ago(w.lastRunAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-green-300">{w.totalListed} listed</p>
                      <button
                        onClick={() => remove(w)}
                        className="text-xs text-white/30 hover:text-red-300"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                  {w.lastError && (
                    <p className="mt-2 truncate text-xs text-red-300">⚠ {w.lastError}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
