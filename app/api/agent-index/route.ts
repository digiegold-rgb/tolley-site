import { NextResponse } from "next/server";
import { SUBSITES, publicSubsites } from "@/lib/subsites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://www.tolley.io";

/**
 * GET /api/agent-index
 *
 * One-stop discovery endpoint. Returns the full manifest array plus pointers
 * to llms.txt, openapi spec, mcp endpoint, and per-subsite manifest URLs.
 *
 * Public, unauthenticated, CORS-open.
 */
export async function GET(_req: Request) {
  const subsites = SUBSITES.map((s) => ({
    ...s,
    manifestUrl: `${BASE}/api/agent/${s.name}`,
    fullUrl: `${BASE}${s.url}`,
  }));

  return NextResponse.json(
    {
      name: "Tolley.io Agent Index",
      base: BASE,
      generatedAt: new Date().toISOString(),
      stats: {
        total: SUBSITES.length,
        public: publicSubsites().length,
        auth: SUBSITES.filter((s) => s.status === "auth").length,
      },
      discovery: {
        agentCard: `${BASE}/.well-known/agent-card.json`,
        llmsTxt: `${BASE}/llms.txt`,
        llmsFullTxt: `${BASE}/llms-full.txt`,
        sitemap: `${BASE}/sitemap.xml`,
        robots: `${BASE}/robots.txt`,
        mcp: `${BASE}/api/mcp`,
        openapi: `${BASE}/api/openapi.json`,
      },
      endpoints: {
        leadCapture: `${BASE}/api/email-capture`,
        share: `${BASE}/api/share`,
        shareResolver: `${BASE}/s/{token}`,
        manifest: `${BASE}/api/agent/{name}`,
      },
      subsites,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
