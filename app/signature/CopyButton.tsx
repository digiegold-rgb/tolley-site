"use client";

import { useState } from "react";

export default function CopyButton({ html }: { html: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([html], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      setState("copied");
    } catch {
      try {
        await navigator.clipboard.writeText(html);
        setState("copied");
      } catch {
        setState("error");
      }
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button
      onClick={copy}
      className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 active:scale-95"
    >
      {state === "copied"
        ? "✓ Copied — paste into your email settings"
        : state === "error"
          ? "Copy failed — select the preview and copy manually"
          : "Copy Signature"}
    </button>
  );
}
