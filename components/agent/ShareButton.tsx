"use client";

import { useState } from "react";

/**
 * Mints a /s/<token> share link via POST /api/share, copies the URL to the
 * clipboard, and tracks the click count via the resolver. Anyone (humans or
 * AI agents) can mint a link without auth.
 *
 *   <ShareButton subsite="wd" path="/wd" title="Washer/dryer rental KC" />
 */
type Props = {
  subsite: string;
  path?: string;
  title?: string;
  label?: string;
  className?: string;
};

export function ShareButton({
  subsite,
  path,
  title,
  label = "Share",
  className = "",
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function mint() {
    setStatus("loading");
    try {
      const targetPath = path ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subsite, path: targetPath, title }),
      });
      if (!res.ok) throw new Error("share");
      const { url } = (await res.json()) as { url: string };
      const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: title || "Tolley.io", url: fullUrl });
        } else {
          await navigator.clipboard.writeText(fullUrl);
        }
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2200);
      } catch {
        await navigator.clipboard.writeText(fullUrl);
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2200);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2200);
    }
  }

  const text =
    status === "loading" ? "…" :
    status === "copied" ? "Copied!" :
    status === "error" ? "Try again" :
    label;

  return (
    <button
      type="button"
      onClick={mint}
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-medium tracking-wide text-white/80 transition hover:border-white/30 hover:bg-white/[0.08] ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {text}
    </button>
  );
}
