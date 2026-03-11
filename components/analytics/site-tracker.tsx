"use client";

import { useEffect, useCallback } from "react";

function classifyReferrer(ref: string): string {
  if (!ref) return "direct";
  const r = ref.toLowerCase();
  if (r.includes("google")) return "google";
  if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
  if (r.includes("instagram")) return "instagram";
  if (r.includes("tiktok")) return "tiktok";
  if (r.includes("twitter") || r.includes("x.com")) return "twitter";
  if (r.includes("nextdoor")) return "nextdoor";
  if (r.includes("craigslist")) return "craigslist";
  if (r.includes("offerup")) return "offerup";
  if (r.includes("yelp")) return "yelp";
  if (r.includes("youtube")) return "youtube";
  if (r.includes("reddit")) return "reddit";
  if (r.includes("linkedin")) return "linkedin";
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

/** Universal page view + event tracker. Drop into any site layout. */
export function SiteTracker({ site }: { site: string }) {
  useEffect(() => {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view",
        site,
        path: window.location.pathname,
        referrer: getReferrer(),
      }),
    }).catch(() => {});
  }, [site]);

  return null;
}

/** Track a specific event (phone click, CTA, form, etc.) */
export function trackEvent(
  site: string,
  event: string,
  label?: string,
  meta?: Record<string, unknown>,
) {
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "event",
      site,
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      event,
      label,
      referrer: getReferrer(),
      meta,
    }),
  }).catch(() => {});
}

/**
 * Wraps children and attaches click tracking to [data-track-event] elements.
 * Usage: <EventTracker site="trailer"><button data-track-event="phone_click">Call</button></EventTracker>
 */
export function EventTracker({
  site,
  children,
}: {
  site: string;
  children: React.ReactNode;
}) {
  const handleClick = useCallback(
    (e: Event) => {
      const target = (e.target as HTMLElement).closest("[data-track-event]");
      if (!target) return;
      const event = target.getAttribute("data-track-event") || "click";
      const label = target.getAttribute("data-track-label") || undefined;
      trackEvent(site, event, label);
    },
    [site],
  );

  useEffect(() => {
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [handleClick]);

  return <>{children}</>;
}
