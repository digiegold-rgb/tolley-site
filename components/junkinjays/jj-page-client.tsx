"use client";

import { useEffect, useCallback } from "react";
import { JjTracker } from "./jj-tracker";

export function JjPageClient({ children }: { children: React.ReactNode }) {
  const trackPhoneClick = useCallback(() => {
    const ref = document.referrer || "";
    let source = "direct";
    if (ref.includes("facebook")) source = "facebook";
    else if (ref.includes("craigslist")) source = "craigslist";
    else if (ref.includes("nextdoor")) source = "nextdoor";
    else if (ref.includes("tolley.io")) source = "tolley_internal";
    else if (ref) source = ref;

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");
    if (refParam) source = refParam;

    fetch("/api/junkinjays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "phone_click", referrer: source }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Attach click tracking to all phone links
    const handler = (e: Event) => {
      const target = (e.target as HTMLElement).closest("[data-phone-click]");
      if (target) trackPhoneClick();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [trackPhoneClick]);

  return (
    <>
      <JjTracker />
      {children}
    </>
  );
}
