"use client";
import { browserAttribution } from "@/lib/discovery-browser";
import { attributionSource } from "@/lib/discovery-attribution";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution, visitorSessionId } from "@/lib/lead-capture-client";

import { analyticsSiteForPath } from "@/lib/analytics-site";

function getReferrer() { return attributionSource(browserAttribution()); }

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
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view",
        site,
        path: pathname,
        referrer: getReferrer(),
        attribution: browserAttribution(),
        sessionId: visitorSessionId(),
        campaign: captureAttribution(),
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
