import type { MetadataRoute } from "next";
import { ADMIN_ROUTES } from "@/lib/agent-manifest";

const BASE = "https://www.tolley.io";

export const dynamic = "force-dynamic";

/**
 * Dynamic robots.txt. Replaces public/robots.txt.
 *
 * Public surface: open to all bots, including AI training crawlers, on every
 * route EXCEPT admin (which is always disallowed).
 *
 * Each AI bot of interest is named explicitly so policy is explicit and
 * auditable, even though `User-agent: *` covers them.
 */
export default function robots(): MetadataRoute.Robots {
  const adminDisallow = [...ADMIN_ROUTES];

  const aiBots = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "anthropic-ai",
    "Claude-Web",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "Bytespider",
    "DuckAssistBot",
    "Meta-ExternalAgent",
    "cohere-ai",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: adminDisallow },
      ...aiBots.map((ua) => ({ userAgent: ua, allow: "/", disallow: adminDisallow })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
