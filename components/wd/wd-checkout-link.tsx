"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/components/analytics/site-tracker";
import { gtagEvent } from "@/components/analytics/ga4";
import { fbqEvent } from "@/components/analytics/meta-pixel";
import { visitorSessionId } from "@/lib/lead-capture-client";
import { normalizeWdZip, wdCheckoutZipDecision } from "@/lib/wd-service-zips";
import { WdOutOfAreaCapture } from "./wd-out-of-area";

interface WdCheckoutLinkProps {
  plan: "washer" | "bundle";
  label: string;
  children: React.ReactNode;
  className?: string;
  variant?: "hero" | "card";
}

/**
 * ZIP-gated checkout. Stripe is opened only after the server accepts the ZIP.
 */
export function WdCheckoutLink({ plan, label, children, className, variant = "card" }: WdCheckoutLinkProps) {
  const params = useSearchParams();
  const promo = params.get("promo") || params.get("code") || "";
  const [zip, setZip] = useState("");
  const [phase, setPhase] = useState<"edit" | "checking" | "out" | "error">("edit");
  const [message, setMessage] = useState("");
  const [acceptedZip, setAcceptedZip] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === "checking") return;
    const decision = wdCheckoutZipDecision(zip);
    if (!decision.ok && decision.status === 400) {
      setMessage(decision.error);
      setPhase("error");
      return;
    }
    setPhase("checking");
    setMessage("");
    const sessionId = visitorSessionId();
    try {
      const res = await fetch("/api/wd/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip: normalizeWdZip(zip) || zip.trim(),
          plan,
          ...(promo ? { promo } : {}),
          ...(sessionId ? { clientReferenceId: `tolley_${sessionId}` } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string; outOfArea?: boolean } | null;
      if (data?.outOfArea || res.status === 422 || (decision.ok === false && decision.outOfArea && !res.ok)) {
        setAcceptedZip(normalizeWdZip(zip) || zip.trim());
        setPhase("out");
        return;
      }
      if (!res.ok || !data?.url) {
        setMessage(data?.error || "Checkout could not be started. Please call us.");
        setPhase("error");
        return;
      }
      trackEvent("wd", "checkout_click", label, { promo: promo || "none" });
      gtagEvent("begin_checkout", { item_name: label, coupon: promo });
      fbqEvent("InitiateCheckout", { content_name: label });
      window.location.assign(data.url);
    } catch {
      if (!decision.ok && decision.outOfArea) {
        setAcceptedZip(normalizeWdZip(zip) || zip.trim());
        setPhase("out");
        return;
      }
      setMessage("Checkout could not be started. Please call us.");
      setPhase("error");
    }
  }

  if (phase === "out") {
    return (
      <div className={variant === "hero" ? "w-full max-w-md rounded-2xl bg-white p-4 text-left shadow-lg" : "mt-6"}>
        <WdOutOfAreaCapture zip={acceptedZip} unitType={plan} />
      </div>
    );
  }

  const inputClass = variant === "hero"
    ? "w-full rounded-full border border-white/50 bg-white px-4 py-3 text-sm font-semibold text-blue-900 placeholder:text-blue-300 sm:w-36"
    : "wd-input w-full";

  return (
    <form onSubmit={handleSubmit} className={variant === "hero" ? "flex w-full max-w-xl flex-wrap items-center gap-2" : "mt-6 grid gap-3"}>
      <input
        aria-label="Delivery ZIP"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={10}
        required
        placeholder="Delivery ZIP"
        value={zip}
        onChange={(e) => { setZip(e.target.value); if (phase === "error") setPhase("edit"); }}
        className={inputClass}
      />
      <button type="submit" disabled={phase === "checking"} className={className}>
        {phase === "checking" ? "Checking ZIP..." : children}
      </button>
      {message && <p role="alert" className={variant === "hero" ? "basis-full text-sm text-white" : "text-sm text-red-700"}>{message}</p>}
    </form>
  );
}
