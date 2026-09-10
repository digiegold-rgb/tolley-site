"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution, visitorSessionId } from "@/lib/lead-capture-client";

import { analyticsSiteForPath } from "@/lib/analytics-site";

function classifyReferrer(ref: string): string {
  if (!ref) return "direct";
  const r = ref.toLowerCase();
  if (r.includes("google")) return "google";
  if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
  if (r.includes("instagram")) return "instagram";
  if (r.includes("tiktok")) return "tiktok";
  if (r.includes("twitter") || r.includes("x.com")) return "twitter";
  if (r.includes("youtube")) return "youtube";
  if (r.includes("reddit")) return "reddit";
  if (r.includes("linkedin")) return "linkedin";
  if (r.includes("bing")) return "bing";
  if (r.includes("tolley.io")) return "internal";
  return "other";
}

function getReferrer(): string {
  if (typeof window === "undefined") return "direct";
  const params = new URLSearchParams(window.location.search);
  const refParam = params.get("ref") || params.get("utm_source");
  if (refParam) return refParam;
  return classifyReferrer(document.referrer);
}

/**
 * The sole pageview owner for public and customer routes. Mounted once in
 * the root layout; pathname changes track navigation between subsites.
 */
export function MainSiteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const site = analyticsSiteForPath(pathname);
    if (!site) return;

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view",
        site,
        path: pathname,
        referrer: getReferrer(),
        sessionId: visitorSessionId(),
        campaign: captureAttribution(),
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
