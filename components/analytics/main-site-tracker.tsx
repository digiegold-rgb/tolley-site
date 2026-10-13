"use client";
import { journeyCapture } from "@/lib/customer-history/browser";
import { browserAttribution } from "@/lib/discovery-browser";
import { attributionSource } from "@/lib/discovery-attribution";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/lead-capture-client";

import { analyticsSiteForPath } from "@/lib/analytics-site";

function getReferrer() { return attributionSource(browserAttribution()); }

/**
 * The sole pageview owner for public and customer routes. Mounted once in
 * the root layout; pathname changes track navigation between subsites.
 */
export function MainSiteTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;

    const site = analyticsSiteForPath(pathname);
    if (!site) return;

    fetch("/api/analytics", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view",
        site,
        path: pathname,
        referrer: getReferrer(),
        attribution: browserAttribution(),
        ...journeyCapture(),
        eventKey: crypto.randomUUID(),
        campaign: captureAttribution(),
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
