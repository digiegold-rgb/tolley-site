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
  // ADMIN_ROUTES (owner consoles) + every auth-gated app surface. Before this
  // list, ~120 dashboard/login-wall pages were crawlable and diluted the crawl
  // budget of the ~85 real marketing pages. Public marketing roots (/vater,
  // /shop, /drive, /leads/pricing…) stay allowed — only app internals block.
  const internalDisallow = [
    "/api/",
    "/hq",
    "/chat",
    "/action",
    "/tv",
    "/research",
    "/signature",
    "/food/",
    "/shop/dashboard",
    "/shop/admin",
    "/drive/dashboard",
    "/drive/driver",
    "/drive/admin",
    "/pools/admin",
    "/rentals/admin",
    "/wd/admin",
    "/vater/youtube",
    "/vater/budget",
    "/vater/chat",
    "/video/edit",
    "/video/studio",
    "/junkinjays/analytics",
    "/start/analytics",
    "/leads/dashboard",
    "/leads/clients",
    "/leads/admin",
    "/leads/demo",
    "/leads/digest",
    "/leads/crm",
    "/leads/pipeline",
    "/leads/dossier",
    "/leads/settings",
    "/v/",
    "/demo/",
    "/biz/",
    "/settings",
    "/billing",
  ];
  const adminDisallow = [...ADMIN_ROUTES, ...internalDisallow];

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
