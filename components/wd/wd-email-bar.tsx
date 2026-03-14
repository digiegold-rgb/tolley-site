"use client";

import { useState, useEffect } from "react";
import { trackEvent } from "@/components/analytics/site-tracker";
import { gtagEvent } from "@/components/analytics/ga4";
import { fbqEvent } from "@/components/analytics/meta-pixel";

export function WdEmailBar() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already submitted (persisted in localStorage)
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("wd_email_captured")) {
      setDismissed(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "sending") return;

    setStatus("sending");
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event",
        site: "wd",
        path: "/wd",
        event: "email_capture",
        label: "sticky_bar",
        meta: { email },
      }),
    }).catch(() => {});

    trackEvent("wd", "email_capture", "sticky_bar", { email });
    gtagEvent("sign_up", { method: "email_bar" });
    fbqEvent("CompleteRegistration", { content_name: "email_bar" });

    localStorage.setItem("wd_email_captured", "1");
    setStatus("done");
  }

  if (dismissed || status === "done") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 safe-bottom">
      <div className="mx-auto max-w-3xl px-4 pb-4">
        <div className="relative rounded-2xl border border-blue-200 bg-white/95 px-5 py-3.5 shadow-xl shadow-blue-200/30 backdrop-blur-lg">
          <button
            onClick={() => setDismissed(true)}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-500 text-xs font-bold hover:bg-blue-200 transition"
            aria-label="Dismiss"
          >
            X
          </button>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <p className="text-sm font-bold text-blue-900 sm:shrink-0">
              Service updates & availability alerts
            </p>
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="wd-input flex-1 text-sm"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:shrink-0"
            >
              {status === "sending" ? "..." : "Subscribe"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
