"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Any path starting with one of these prefixes has its own per-site
// SiteTracker in its own layout — we skip those here to avoid double-tracking.
const SUBSITE_PREFIXES = [
  "/wd",
  "/trailer",
  "/generator",
  "/homes",
  "/video",
  "/start",
  "/pools",
  "/moupins",
  "/rental",
  "/shop",
  "/food",
  "/drive",
  "/junkinjays",
  "/lastmile",
  "/hvac",
  "/client",
  "/tables",
  "/kerplunk",
  "/moving",
  "/picnic-table",
  "/scan",
  "/manus",
  "/water",
  "/vater",
];

// Paths we explicitly never track as "home" views.
const NEVER_TRACK = [
  "/api/",
  "/admin",
  "/_next",
];

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
 * Fires a pageview for any tolley.io path that isn't a known subsite
 * (which has its own SiteTracker). Mounted once in the root layout.
 */
export function MainSiteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // Subsites track themselves.
    const isSubsite = SUBSITE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
    if (isSubsite) return;

    // Never-track paths.
    if (NEVER_TRACK.some((p) => pathname.startsWith(p))) return;

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view",
        site: "home",
        path: pathname,
        referrer: getReferrer(),
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
