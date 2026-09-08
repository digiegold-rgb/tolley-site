"use client";

import { useState, useSyncExternalStore } from "react";
import { trackEvent } from "@/components/analytics/site-tracker";
import { gtagEvent } from "@/components/analytics/ga4";
import { fbqEvent } from "@/components/analytics/meta-pixel";
import { submitLead, captureAttribution } from "@/lib/lead-capture-client";
import { WD_SMS_PHONE } from "@/lib/wd";

const PRIVACY_URL = "https://www.tolley.io/wd/privacy";
const TERMS_URL = "https://www.tolley.io/wd/terms";
function subscribeToCapture(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function wasCaptured() {
  try { return !!localStorage.getItem("wd_email_captured"); } catch { return false; }
}

export function WdEmailBar() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const previouslyCaptured = useSyncExternalStore(subscribeToCapture, wasCaptured, () => false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "sending") return;

    setStatus("sending");
    setError("");
    try {
      await submitLead("/api/email-capture", {
        email: email.trim(), source: "wd",
        data: { phone: phone.trim() || undefined, smsConsent, ...captureAttribution() },
      });
      trackEvent("wd", "email_capture", "sticky_bar");
      gtagEvent("generate_lead", { method: "email_bar" });
      fbqEvent("Lead", { content_name: "email_bar" });
      try { localStorage.setItem("wd_email_captured", "1"); } catch { /* storage is optional */ }
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      setStatus("idle");
    }
  }

  if (dismissed || previouslyCaptured || status === "done") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 safe-bottom">
      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="relative rounded-2xl border border-blue-200 bg-white/95 px-5 py-3.5 shadow-xl shadow-blue-200/30 backdrop-blur-lg">
          <button
            onClick={() => setDismissed(true)}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-500 text-xs font-bold hover:bg-blue-200 transition"
            aria-label="Dismiss"
          >
            X
          </button>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
              <input
                type="tel"
                placeholder="Mobile (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="wd-input flex-1 text-sm"
                autoComplete="tel"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:shrink-0"
              >
                {status === "sending" ? "..." : "Subscribe"}
              </button>
            </div>

            <label htmlFor="wd-sms-consent" className="flex items-start gap-2 cursor-pointer">
              <input
                id="wd-sms-consent"
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-blue-300 text-blue-600 accent-blue-600"
              />
              <span className="text-[11px] leading-4 text-slate-600">
                I agree to receive recurring account texts from Wash &amp; Dry (Your KC
                Homes LLC) about my rental, delivery, billing, and repairs. Up to 8
                msgs/month. Msg &amp; data rates may apply. Reply STOP to cancel. Reply
                HELP for help. Consent is not required to rent. Privacy Policy:{" "}
                <a
                  href={PRIVACY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                >
                  {PRIVACY_URL}
                </a>{" "}
                Terms:{" "}
                <a
                  href={TERMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                >
                  {TERMS_URL}
                </a>
                .
              </span>
            </label>
            <p className="text-[11px] leading-4 text-slate-500">
              You can also opt in by texting START to {WD_SMS_PHONE}.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
