"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface BatchProduct {
  id: string;
  title: string;
  imageUrl: string | null;
  category: string | null;
  amazonAsin: string | null;
  alreadyDone: boolean;
}

interface Props {
  items: BatchProduct[];
  amazonTag: string;
}

const STORAGE_KEY = "amazon-batch-progress-v1";

export default function BatchClient({ items, amazonTag }: Props) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const [showDone, setShowDone] = useState(true);
  const [savingAsin, setSavingAsin] = useState(false);
  const [asinDraft, setAsinDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [bumpFlash, setBumpFlash] = useState<"open" | "skip" | "save" | null>(
    null
  );

  // Load completed-set from localStorage + seed with already-done items
  useEffect(() => {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    const stored: string[] = raw ? JSON.parse(raw) : [];
    const seeded = new Set([
      ...stored,
      ...items.filter((i) => i.alreadyDone).map((i) => i.id),
    ]);
    setDone(seeded);
  }, [items]);

  function persist(next: Set<string>) {
    setDone(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    }
  }

  const queue = useMemo(
    () => (showDone ? items : items.filter((i) => !done.has(i.id))),
    [items, done, showDone]
  );

  const current = queue[idx] ?? queue[0] ?? null;

  const remaining = items.length - done.size;
  const pct = items.length === 0 ? 0 : Math.round((done.size / items.length) * 100);

  const advance = useCallback(() => {
    setIdx((i) => Math.min(i + 1, Math.max(queue.length - 1, 0)));
    setAsinDraft("");
    setUrlDraft("");
    setStatusMsg(null);
  }, [queue.length]);

  const back = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
    setAsinDraft("");
    setUrlDraft("");
    setStatusMsg(null);
  }, []);

  const openSearch = useCallback(() => {
    if (!current) return;
    const url = `https://www.amazon.com/s?${new URLSearchParams({
      k: current.title,
      tag: amazonTag,
    }).toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setBumpFlash("open");
    setTimeout(() => setBumpFlash(null), 250);
  }, [current, amazonTag]);

  const markDone = useCallback(() => {
    if (!current) return;
    const next = new Set(done);
    next.add(current.id);
    persist(next);
    setBumpFlash("skip");
    setTimeout(() => setBumpFlash(null), 250);
    advance();
  }, [current, done, advance]);

  const saveFromValue = useCallback(
    async (value: string) => {
      if (!current) return false;
      const trimmed = value.trim();
      if (!trimmed) return false;

      const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /amzn\.(to|com)/i.test(trimmed);
      const looksLikeAsin = /^[A-Z0-9]{10}$/i.test(trimmed);
      if (!looksLikeUrl && !looksLikeAsin) {
        setStatusMsg("Paste an Amazon URL or 10-char ASIN");
        return false;
      }

      setSavingAsin(true);
      setStatusMsg(looksLikeUrl ? "Resolving link…" : "Saving ASIN…");
      try {
        let savedAsin: string | null = null;

        if (looksLikeAsin) {
          const asin = trimmed.toUpperCase();
          const res = await fetch(`/api/shop/products/${current.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ amazonAsin: asin }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          savedAsin = asin;
        } else {
          const res = await fetch(
            `/api/shop/products/${current.id}/amazon-url`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ url: trimmed }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.error || `HTTP ${res.status}`);
          }
          savedAsin = data.asin ?? null;
        }

        const next = new Set(done);
        next.add(current.id);
        persist(next);
        setBumpFlash("save");
        setTimeout(() => setBumpFlash(null), 250);
        setStatusMsg(savedAsin ? `Saved ${savedAsin} → next` : "Saved → next");
        advance();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed";
        setStatusMsg(msg);
        return false;
      } finally {
        setSavingAsin(false);
      }
    },
    [current, done, advance]
  );

  const saveAsin = useCallback(() => saveFromValue(asinDraft), [
    saveFromValue,
    asinDraft,
  ]);
  const saveUrl = useCallback(() => saveFromValue(urlDraft), [
    saveFromValue,
    urlDraft,
  ]);

  // Keyboard handlers — global
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if (e.key === "Enter") {
          const value = (e.target as HTMLInputElement | HTMLTextAreaElement)
            .value;
          if (value.trim()) {
            e.preventDefault();
            void saveFromValue(value);
          }
        }
        return;
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        openSearch();
      } else if (e.key === "Enter") {
        e.preventDefault();
        markDone();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "Escape") {
        e.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch, markDone, advance, back, saveFromValue]);

  // Global paste — anywhere on page, drop in an Amazon URL/ASIN to save & advance
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      // Let users paste normally into the visible input fields; their own
      // Enter handler picks it up. Only auto-save when paste lands elsewhere.
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text") ?? "";
      const trimmed = text.trim();
      if (!trimmed) return;

      const isAmazonUrl =
        /amazon\.[a-z.]+\/(?:dp|gp|product)/i.test(trimmed) ||
        /amzn\.(to|com)\//i.test(trimmed);
      const isBareAsin = /^[A-Z0-9]{10}$/i.test(trimmed);
      if (!isAmazonUrl && !isBareAsin) return;

      e.preventDefault();
      void saveFromValue(trimmed);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [saveFromValue]);

  if (queue.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">All done 🎉</h1>
        <p className="mt-3 text-white/70">
          You've added every product to an Amazon Idea List. Go check your
          storefront at{" "}
          <a
            href="https://www.amazon.com/shop/digitaljared"
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="text-purple-300 underline"
          >
            amazon.com/shop/digitaljared
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(STORAGE_KEY);
            }
            persist(new Set(items.filter((i) => i.alreadyDone).map((i) => i.id)));
            setIdx(0);
          }}
          className="mt-6 rounded-md border border-white/15 px-4 py-2 text-xs text-white/60 hover:bg-white/5"
        >
          Reset progress (re-do session-marked items)
        </button>
        <div className="mt-6">
          <Link href="/shop/admin" className="text-xs text-purple-300 underline">
            ← back to inventory
          </Link>
        </div>
      </main>
    );
  }

  if (!current) return null;

  const flashClass =
    bumpFlash === "open"
      ? "ring-amber-400/40"
      : bumpFlash === "save"
        ? "ring-emerald-400/40"
        : bumpFlash === "skip"
          ? "ring-purple-400/40"
          : "ring-transparent";

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-3xl flex-col px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link href="/shop/admin" className="text-white/50 hover:text-white">
          ← back
        </Link>
        <div className="text-white/70">
          <span className="text-white">{done.size}</span>
          <span className="text-white/40"> / {items.length}</span>
          <span className="ml-2 text-[0.7rem] text-white/40">
            ({remaining} remaining · {pct}%)
          </span>
        </div>
        <label className="flex items-center gap-1.5 text-[0.7rem] text-white/50">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
            className="accent-purple-500"
          />
          show done
        </label>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Card */}
      <div
        className={`shop-card rounded-2xl p-4 transition ring-2 ${flashClass}`}
      >
        <div className="flex gap-4">
          {current.imageUrl ? (
            <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <Image
                src={current.imageUrl}
                alt={current.title}
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          ) : (
            <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-3xl text-white/20">
              ?
            </div>
          )}

          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-wide text-white/40">
              <span>{current.category || "uncategorized"}</span>
              {done.has(current.id) && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                  ✓ done
                </span>
              )}
              {current.amazonAsin && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-200">
                  ASIN saved
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold leading-tight text-white">
              {current.title}
            </h2>
            <p className="mt-2 text-[0.7rem] text-white/40">
              Item {idx + 1} of {queue.length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openSearch}
            className="rounded-md bg-[#FF9900] px-4 py-2 text-sm font-bold text-black hover:bg-[#ffb13a]"
          >
            Search on Amazon
            <span className="ml-2 rounded bg-black/20 px-1 py-0.5 text-[0.55rem]">
              SPACE
            </span>
          </button>
          <button
            type="button"
            onClick={markDone}
            className="shop-btn-primary rounded-md px-4 py-2 text-sm"
          >
            Mark done & next
            <span className="ml-2 rounded bg-black/20 px-1 py-0.5 text-[0.55rem]">
              ENTER
            </span>
          </button>
          <button
            type="button"
            onClick={advance}
            className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/60 hover:bg-white/5"
          >
            Skip → →
          </button>
          <button
            type="button"
            onClick={back}
            className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/60 hover:bg-white/5"
          >
            ← Back
          </button>
        </div>

        {/* Primary: paste SiteStripe URL (or anywhere — global paste works too) */}
        <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wide text-amber-200/80">
            Paste SiteStripe link → auto-saves & advances
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://www.amazon.com/dp/B0… or https://amzn.to/…"
              className="shop-input flex-1 rounded-md px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={saveUrl}
              disabled={savingAsin || !urlDraft.trim()}
              className="rounded-md border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/25 disabled:opacity-50"
            >
              {savingAsin ? "Saving…" : "Save & next"}
            </button>
          </div>
          <p className="mt-2 text-[0.6rem] text-white/40">
            Tip: on the Amazon product page, click <strong>Text</strong> in the
            SiteStripe bar at the top → copy → paste anywhere on this page.
            ENTER advances. We auto-extract the ASIN; <code>amzn.to</code> short
            links are resolved server-side.
          </p>
          {statusMsg && (
            <p className="mt-2 text-[0.65rem] text-amber-200/80">{statusMsg}</p>
          )}
        </div>

        {/* Fallback: bare ASIN */}
        <details className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[0.7rem] text-white/60">
          <summary className="cursor-pointer text-white/50 hover:text-white/80">
            Or paste a bare 10-char ASIN
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={asinDraft}
              onChange={(e) => setAsinDraft(e.target.value.toUpperCase())}
              placeholder="B0XXXXXXXX"
              maxLength={10}
              className="shop-input flex-1 rounded-md px-3 py-2 text-sm uppercase tracking-wider"
            />
            <button
              type="button"
              onClick={saveAsin}
              disabled={savingAsin || asinDraft.length !== 10}
              className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
            >
              {savingAsin ? "Saving…" : "Save ASIN & next"}
            </button>
          </div>
        </details>
      </div>

      {/* Hotkey legend */}
      <div className="mt-6 grid grid-cols-2 gap-3 text-[0.7rem] text-white/40 sm:grid-cols-4">
        <Hotkey k="SPACE" desc="open Amazon" />
        <Hotkey k="ENTER" desc="mark done + next" />
        <Hotkey k="→" desc="skip" />
        <Hotkey k="← / ESC" desc="back" />
      </div>

      <p className="mt-6 text-center text-[0.65rem] text-white/30">
        Progress saves locally in this browser. Closing the tab is safe — you
        resume where you left off.
      </p>
    </main>
  );
}

function Hotkey({ k, desc }: { k: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1">
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-mono text-white">
        {k}
      </kbd>
      <span>{desc}</span>
    </div>
  );
}
