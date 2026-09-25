"use client";
import { browserAttribution } from "@/lib/discovery-browser";
import { attributionSource } from "@/lib/discovery-attribution";

import { visitorSessionId } from "@/lib/lead-capture-client";
import { useEffect, useCallback } from "react";

function getReferrer() { return attributionSource(browserAttribution()); }

/** Track a specific event (phone click, CTA, form, etc.) */
export function trackEvent(
  site: string,
  event: string,
  label?: string,
  meta?: Record<string, unknown>,
) {
  fetch("/api/analytics", {
    method: "POST",
      keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "event",
      sessionId: visitorSessionId(),
      site,
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      event,
      label,
      referrer: getReferrer(),
        attribution: browserAttribution(),
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
