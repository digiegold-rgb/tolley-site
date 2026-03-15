"use client";

import { useEffect, useCallback } from "react";
import { trackEvent } from "@/components/analytics/site-tracker";

export function MpPageClient({ children }: { children: React.ReactNode }) {
  const trackPhoneClick = useCallback((type: string) => {
    trackEvent("moupins", "phone_click", type);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e.target as HTMLElement).closest("[data-phone-click]");
      if (target) {
        const label = target.getAttribute("data-phone-click") || "call";
        trackPhoneClick(label);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [trackPhoneClick]);

  return <>{children}</>;
}
