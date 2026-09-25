"use client";
import { useEffect } from "react";
import { SUBSITES } from "@/lib/subsites";
import { trackEvent } from "@/components/analytics/site-tracker";
export function ContactTracker() {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const anchor = e.target.closest("a");
      if (!anchor || anchor.hasAttribute("data-track-event") || anchor.hasAttribute("data-phone-click")) return;
      const href = anchor.getAttribute("href") || "";
      if (!/^(tel:|sms:)/.test(href)) return;
      const path = location.pathname;
      const s = SUBSITES.filter(s => path === s.url || path.startsWith(s.url + "/")).sort((a, b) => b.url.length - a.url.length)[0];
      if (s?.discovery?.disposition !== "offering" && path !== "/services") return;
      trackEvent(s?.name || "services", href.startsWith("tel:") ? "phone_click" : "sms_click");
    };
    document.addEventListener("click", listener);
    return () => document.removeEventListener("click", listener);
  }, []);
  return null;
}
