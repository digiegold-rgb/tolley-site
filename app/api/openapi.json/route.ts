import { NextResponse } from "next/server";
import { SUBSITES, publicSubsites } from "@/lib/subsites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://www.tolley.io";

/**
 * GET /api/openapi.json
 *
 * Minimal OpenAPI 3.1 spec covering the public agent surface:
 *   - GET  /.well-known/agent-card.json
 *   - GET  /api/agent-index
 *   - GET  /api/agent/{name}
 *   - POST /api/share
 *   - GET  /s/{token}
 *   - POST /api/email-capture
 *   - GET  /api/mcp (MCP discovery — actual tool calls are POST per spec)
 *
 * Per-subsite endpoints (jsonEndpoints) are listed too, derived from manifests.
 */
export async function GET() {
  const perSubsitePaths: Record<string, unknown> = {};
  for (const s of SUBSITES) {
    for (const ep of s.jsonEndpoints) {
      perSubsitePaths[ep] = {
        get: {
          summary: `${s.title} — JSON snapshot`,
          description: `Public JSON for ${s.title} (${s.purpose}).`,
          tags: [s.name],
          responses: {
            "200": { description: "OK", content: { "application/json": {} } },
          },
        },
      };
    }
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Tolley.io Agent API",
      version: "2.0.0",
      description:
        "Agent-facing surface for tolley.io: discovery, lead capture, share links, MCP.",
      contact: { name: "Tolley.io", url: BASE },
    },
    servers: [{ url: BASE }],
    paths: {
      "/.well-known/agent-card.json": {
        get: {
          summary: "A2A agent card",
          tags: ["discovery"],
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/agent-index": {
        get: {
          summary: "Full subsite index",
          tags: ["discovery"],
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/agent/{name}": {
        get: {
          summary: "Per-subsite manifest",
          tags: ["discovery"],
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string" } },
            { name: "include", in: "query", schema: { type: "string", enum: ["data"] } },
          ],
          responses: { "200": { description: "OK" }, "404": { description: "Unknown subsite" } },
        },
      },
      "/api/share": {
        post: {
          summary: "Mint a share link",
          tags: ["share"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["subsite"],
                  properties: {
                    subsite: { type: "string" },
                    path: { type: "string" },
                    title: { type: "string" },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
      },
      "/s/{token}": {
        get: {
          summary: "Resolve share link",
          tags: ["share"],
          parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
          responses: { "302": { description: "Redirect" }, "404": { description: "Not found" } },
        },
      },
      "/api/email-capture": {
        post: {
          summary: "Capture a lead email",
          tags: ["lead"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "source"],
                  properties: {
                    email: { type: "string", format: "email" },
                    name: { type: "string" },
                    source: { type: "string" },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" }, "400": { description: "Bad request" } },
        },
      },
      "/api/mcp": {
        post: {
          summary: "MCP server endpoint (Model Context Protocol)",
          tags: ["mcp"],
          responses: { "200": { description: "OK" } },
        },
      },
      ...perSubsitePaths,
    },
    "x-tolley-subsites": publicSubsites().map((s) => ({
      name: s.name,
      url: `${BASE}${s.url}`,
      manifest: `${BASE}/api/agent/${s.name}`,
    })),
  };

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
