"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Stage = "auth" | "compose" | "polling" | "done";

interface ScanState {
  id: string;
  chatId: string;
  chatName: string | null;
  count: number;
  status: string; // queued | scraping | enqueued | failed
  batchId: string | null;
  photosFound: number;
  groups: number;
  skipped: number;
  lastStage: string | null;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ScanItem {
  id: string;
  status: string; // queued | analyzing | searching | drafted | failed
  title: string | null;
  thumbnail: string | null;
  productId: string | null;
  lastError: string | null;
}

const FB_DRAFTS_URL = "https://www.facebook.com/marketplace/you/selling?state=DRAFT";

function scanStageLabel(s: ScanState): string {
  switch (s.status) {
    case "queued":
      return "Waiting for the DGX worker to pick up the scan…";
    case "scraping":
      return "Pulling photos from WhatsApp + uploading…";
    case "enqueued":
      return `Found ${s.photosFound} photos → ${s.groups} items. Cataloging…`;
    case "failed":
      return "Scan failed";
    default:
      return s.status;
  }
}

function itemPill(item: ScanItem): { label: string; color: string } {
  switch (item.status) {
    case "queued":
      return { label: "Queued", color: "bg-white/10 text-white/60" };
    case "analyzing":
      return { label: "Analyzing photos", color: "bg-amber-500/20 text-amber-200" };
    case "searching":
      return { label: "Pricing", color: "bg-blue-500/20 text-blue-200" };
    case "drafted":
      return { label: "FB draft queued ✓", color: "bg-green-500/20 text-green-200" };
    case "failed":
      return { label: "Failed ✗", color: "bg-red-500/25 text-red-200" };
    default:
      return { label: item.status, color: "bg-white/10 text-white/60" };
  }
}

export default function WhatsappScanPage() {
  const [stage, setStage] = useState<Stage>("auth");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [error, setError] = useState("");

  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [count, setCount] = useState(50);
  const [groupMode, setGroupMode] = useState<"smart" | "single">("smart");

  const [scan, setScan] = useState<ScanState | null>(null);
  const [items, setItems] = useState<ScanItem[]>([]);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/shop/auth", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setStage("compose");
            return;
          }
        }
      } catch {
        // fall through
      }
      setStage("auth");
    })();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    try {
      const res = await fetch("/api/shop/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setPinError("Wrong PIN");
        return;
      }
      setStage("compose");
    } catch {
      setPinError("Network error");
    }
  }

  const startPolling = useCallback((id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    const tick = async () => {
      try {
        const res = await fetch(`/api/shop/whatsapp/scan/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { scan: ScanState; items: ScanItem[] };
        setScan(data.scan);
        setItems(data.items);

        const scanFailed = data.scan.status === "failed";
        const handedOff = data.scan.status === "enqueued";
        const allItemsDone =
          data.items.length > 0 &&
          data.items.every((i) => i.status === "drafted" || i.status === "failed");
        if (scanFailed || (handedOff && allItemsDone)) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setStage("done");
        }
      } catch {
        // swallow — next tick retries
      }
    };
    void tick();
    pollTimerRef.current = setInterval(tick, 3000);
  }, []);

  async function handleScan() {
    setError("");
    const trimmed = chatId.trim();
    if (trimmed.length < 5) {
      setError("Enter a phone number (e.g. 18165551234) or a WhatsApp chat ID.");
      return;
    }
    try {
      const res = await fetch("/api/shop/whatsapp/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: trimmed,
          chatName: chatName.trim() || undefined,
          count,
          groupMode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || data.error || "Failed to start scan");
        return;
      }
      const data = (await res.json()) as { scan: { id: string } };
      setStage("polling");
      startPolling(data.scan.id);
    } catch {
      setError("Network error starting scan");
    }
  }

  const drafted = items.filter((i) => i.status === "drafted").length;
  const failed = items.filter((i) => i.status === "failed").length;

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">
            WhatsApp → Shop <span className="text-green-400">scan</span>
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/shop/whatsapp/watches" className="text-green-300 hover:text-green-200">
              Auto-watch →
            </Link>
            <Link href="/shop/dashboard" className="text-white/50 hover:text-white">
              Dashboard
            </Link>
          </div>
        </div>

        {stage === "auth" && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <p className="text-white/60 text-sm">Enter the shop admin PIN to continue.</p>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-green-400"
            />
            {pinError && <p className="text-red-300 text-sm">{pinError}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-green-500 hover:bg-green-400 text-black font-medium py-3"
            >
              Unlock
            </button>
          </form>
        )}

        {stage === "compose" && (
          <div className="space-y-5">
            <p className="text-white/60 text-sm leading-relaxed">
              Point at a WhatsApp chat and we&apos;ll pull every photo, group the
              shots of each item, write the listing with AI, and queue a Facebook
              Marketplace draft — automatically.
            </p>

            <label className="block">
              <span className="text-sm text-white/70">Chat (phone number or WhatsApp ID)</span>
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="18165551234  or  12036…@g.us"
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-green-400"
              />
              <span className="text-xs text-white/40">
                A phone number works for a 1:1 chat; use the full <code>@g.us</code> ID for a group.
              </span>
            </label>

            <label className="block">
              <span className="text-sm text-white/70">Label (optional)</span>
              <input
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="e.g. Garage cleanout crew"
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-green-400"
              />
            </label>

            <div className="block">
              <span className="text-sm text-white/70">How should photos become listings?</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGroupMode("smart")}
                  className={`rounded-lg border px-3 py-2 text-left text-xs ${
                    groupMode === "smart"
                      ? "border-green-400/60 bg-green-500/15 text-green-100"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  <b>Smart-group</b>
                  <br />multi-angle shots of one item → one listing
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode("single")}
                  className={`rounded-lg border px-3 py-2 text-left text-xs ${
                    groupMode === "single"
                      ? "border-green-400/60 bg-green-500/15 text-green-100"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  <b>One per photo</b>
                  <br />each photo = its own item (bin stores, mixed lots)
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-sm text-white/70">
                Look back through the last <b className="text-white">{count}</b> photos
              </span>
              <input
                type="range"
                min={10}
                max={300}
                step={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-2 w-full accent-green-400"
              />
            </label>

            {error && <p className="text-red-300 text-sm">{error}</p>}

            <button
              onClick={handleScan}
              className="w-full rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold py-3"
            >
              Scan &amp; auto-list
            </button>

            <p className="text-xs text-white/35 leading-relaxed">
              Tip: if a scan comes back with 0 photos, open that chat on your phone
              (or send a message in it) so WhatsApp syncs its history to the bridge,
              then scan again. Very old photos whose media has expired on
              WhatsApp&apos;s servers are skipped automatically.
            </p>
          </div>
        )}

        {(stage === "polling" || stage === "done") && scan && (
          <div className="space-y-5">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">
                  {scan.chatName || scan.chatId}
                </span>
                <span className="text-xs text-white/40">{scan.status}</span>
              </div>
              <p className="mt-2 text-sm text-white/90">{scanStageLabel(scan)}</p>
              {(scan.photosFound > 0 || scan.skipped > 0) && (
                <p className="mt-1 text-xs text-white/45">
                  {scan.photosFound} photos · {scan.groups} items · {scan.skipped} skipped
                </p>
              )}
              {scan.status === "failed" && scan.lastError && (
                <p className="mt-2 text-sm text-red-300">{scan.lastError}</p>
              )}
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>{items.length} items</span>
                  <span>
                    {drafted} drafted{failed > 0 ? ` · ${failed} failed` : ""}
                  </span>
                </div>
                {items.map((item) => {
                  const pill = itemPill(item);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-2"
                    >
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="h-12 w-12 rounded object-cover bg-white/10"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white/90">
                          {item.title || "Analyzing…"}
                        </p>
                        {item.lastError && (
                          <p className="truncate text-xs text-red-300">{item.lastError}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded px-2 py-1 text-xs ${pill.color}`}>
                        {pill.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {stage === "done" && (
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={FB_DRAFTS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-green-500 hover:bg-green-400 text-black font-medium px-4 py-2 text-sm"
                >
                  Open Facebook drafts
                </a>
                <Link
                  href="/shop/dashboard"
                  className="rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm"
                >
                  View inventory
                </Link>
                <button
                  onClick={() => {
                    setScan(null);
                    setItems([]);
                    setChatId("");
                    setChatName("");
                    setError("");
                    setStage("compose");
                  }}
                  className="rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm"
                >
                  Scan another chat
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
