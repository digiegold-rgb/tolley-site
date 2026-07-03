import { NextResponse } from "next/server";
import { SUBSITES, publicSubsites } from "@/lib/subsites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://www.tolley.io";

/**
 * GET /.well-known/agent-card.json
 *
 * A2A agent card describing every public subsite under tolley.io.
 * Replaces the previous static file at public/.well-known/agent-card.json.
 *
 * Each public subsite contributes a `skill` derived from its manifest, plus
 * the generic `get_subsite_info` and `list_subsites` tools registered on the
 * MCP server.
 */
export async function GET() {
  const skills = [
    {
      id: "list_subsites",
      name: "List Subsites",
      description: "Returns all public subsites of tolley.io with manifests.",
    },
    {
      id: "get_subsite_info",
      name: "Get Subsite Info",
      description: "Fetch the manifest + live JSON snapshot for a named subsite.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    ...publicSubsites().map((s) => ({
      id: `subsite:${s.name}`,
      name: s.title,
      description: s.purpose,
      url: `${BASE}${s.url}`,
      manifestUrl: `${BASE}/api/agent/${s.name}`,
      leadEndpoint: `${BASE}${s.leadEndpoint}`,
      shareEndpoint: `${BASE}${s.shareEndpoint}`,
      mcpTools: s.mcpTools,
      category: s.category,
    })),
  ];

  return NextResponse.json(
    {
      name: "Tolley.io",
      description:
        "Kansas City rentals, real estate, e-commerce, and AI services — every public subsite is agent-discoverable, lead-capturing, and shareable.",
      url: BASE,
      provider: {
        organization: "Your KC Homes LLC",
        url: BASE,
      },
      version: "2.0.0",
      capabilities: {
        streaming: false,
        pushNotifications: false,
        mcp: true,
        share: true,
        leadCapture: true,
      },
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["application/json"],
      mcpEndpoint: `${BASE}/api/mcp`,
      indexEndpoint: `${BASE}/api/agent-index`,
      llmsTxt: `${BASE}/llms.txt`,
      openapiEndpoint: `${BASE}/api/openapi.json`,
      sitemap: `${BASE}/sitemap.xml`,
      skills,
      meta: {
        totalSubsites: SUBSITES.length,
        publicSubsites: publicSubsites().length,
        generatedAt: new Date().toISOString(),
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
