"use client";

import { useState } from "react";

type EmailCaptureFormProps = {
  source: string;
  placeholder?: string;
  ctaText?: string;
  successMessage?: string;
  data?: Record<string, unknown>;
  className?: string;
};

export function EmailCaptureForm({
  source,
  placeholder = "your@email.com",
  ctaText = "Send My Results",
  successMessage = "Check your inbox — results are on their way.",
  data,
  className = "",
}: EmailCaptureFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, data }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Something went wrong. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div className={`rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3 text-center ${className}`}>
        <p className="text-sm text-emerald-200/80">✓ {successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        required
        className="flex-1 rounded-full border border-white/18 bg-white/[0.06] px-5 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet-400/40 focus:bg-white/[0.08]"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-full border border-violet-200/45 bg-violet-300/20 px-6 py-3 text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_20px_rgba(139,92,246,0.15)] transition hover:bg-violet-300/28 disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : ctaText}
      </button>
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </form>
  );
}
