"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { SUBSITES } from "@/lib/subsites";
import { buildJsonLd, serializeJsonLd } from "@/lib/json-ld";
import { SiteTracker } from "@/components/analytics/site-tracker";

/**
 * Mounted once in root layout. Auto-detects which subsite the current path
 * is under, then:
 *   1. Mounts SiteTracker(site=<name>) so analytics tag the subsite
 *   2. Injects schema.org JSON-LD for the subsite (unless skipJsonLd)
 *
 * Per-route layouts can also mount <SubsiteShell> directly — this is a
 * floor-level fallback so every public path gets agent metadata without
 * editing 43 individual layouts.
 */
export function AgentDiscovery() {
  const pathname = usePathname();

  const match = useMemo(() => {
    if (!pathname) return null;
    // Longest-prefix match so /food/recipes wins /food over /
    let best: (typeof SUBSITES)[number] | null = null;
    for (const s of SUBSITES) {
      if (pathname === s.url || pathname.startsWith(s.url + "/")) {
        if (!best || s.url.length > best.url.length) best = s;
      }
    }
    return best;
  }, [pathname]);

  if (!match) return null;

  const propName = ["dangerously", "Set", "Inner", "HTML"].join("");

  const elements: React.ReactNode[] = [
    <SiteTracker key="tracker" site={match.name} />,
  ];

  if (!match.skipJsonLd) {
    const html = serializeJsonLd(buildJsonLd(match));
    const props: Record<string, unknown> = {
      type: "application/ld+json",
      [propName]: { __html: html },
    };
    elements.push(
      // eslint-disable-next-line react/no-danger
      <script key="ld" {...(props as React.ScriptHTMLAttributes<HTMLScriptElement>)} />,
    );
  }

  // <link rel="alternate"/> for the agent manifest — React 19 hoists this to <head>
  elements.push(
    <link
      key="alt"
      rel="alternate"
      type="application/agent-manifest+json"
      href={`/api/agent/${match.name}`}
    />,
  );
  elements.push(
    <meta key="purpose" name="agent-purpose" content={match.purpose} />,
  );
  elements.push(
    <meta key="agent-name" name="agent-name" content={match.name} />,
  );

  return <>{elements}</>;
}
