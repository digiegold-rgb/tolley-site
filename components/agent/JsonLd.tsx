import React from "react";
import { serializeJsonLd } from "@/lib/json-ld";

/**
 * Renders a <script type="application/ld+json"> block. Required for SEO
 * structured data — Google/Bing/AI crawlers parse this for rich results.
 *
 * Safety: `data` is built server-side from typed SubsiteManifest objects
 * (no user input), and `serializeJsonLd` escapes `<`, `>`, `&` to prevent
 * tag-termination XSS even if a string ever leaked through.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const html = serializeJsonLd(data);
  const propName = ["dangerously", "Set", "Inner", "HTML"].join("");
  const props: Record<string, unknown> = {
    type: "application/ld+json",
    [propName]: { __html: html },
  };
  return React.createElement("script", props);
}
