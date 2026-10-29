import { companyOpenApiPaths } from "@/lib/company/openapi";
import { NextResponse } from "next/server";
import { publicSubsites } from "@/lib/subsites";

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
 *   - POST /api/mcp (MCP Streamable HTTP)
 *
 * Per-subsite endpoints (jsonEndpoints) are listed too, derived from manifests.
 */
export async function GET() {
  const perSubsitePaths: Record<string, unknown> = {};
  for (const s of publicSubsites()) {
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
      version: "2.0.1",
      description:
        "Agent-facing surface for tolley.io: discovery, lead capture, share links, MCP.",
      contact: { name: "Tolley.io", url: BASE },
    },
    servers: [{ url: BASE }],
    components: { securitySchemes: { companyKey: { type: "http", scheme: "bearer", description: "Explicit company scopes and a monthly limit; configure in /services/agent." } } },
    paths: {
      ...companyOpenApiPaths,
      "/api/cleanouts/quote": {
        post: {
          operationId: "requestCleanoutQuote",
          summary: "Request a free Kansas City cleanout quote",
          description: "Submit only when the customer asks to be contacted. Include a phone number so Tolley Clean Outs can respond. A successful receipt means the inquiry was saved; it is not a price, booking, payment, or confirmed availability. Do not submit test inquiries to this production endpoint.",
          tags: ["cleanouts", "lead"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", maxLength: 120, description: "Customer name" },
                    phone: { type: "string", maxLength: 40, description: "Customer callback number" },
                    address: { type: "string", maxLength: 200, description: "Job address or area" },
                    details: { type: "string", maxLength: 2000, description: "Items, rooms, access, and requested timing" },
                    smsConsent: { type: "boolean", default: false, description: "True only if the customer explicitly opted into the SMS terms at https://www.tolley.io/cleanouts/terms. Not required for an inquiry." },
                  },
                  anyOf: ["name", "phone", "address", "details"].map(field => ({ required: [field], properties: { [field]: { type: "string", minLength: 1 } } })),
                },
              },
            },
          },
          responses: {
            "200": { description: "Inquiry saved", content: { "application/json": { schema: { type: "object", required: ["ok", "leadId"], properties: { ok: { type: "boolean", const: true }, leadId: { type: "string" } } } } } },
            "400": { description: "No nonblank name, phone, address, or details supplied" },
            "429": { description: "Rate limit reached; wait before retrying or use the public phone contact" },
            "500": { description: "Inquiry not confirmed saved; do not report success" },
          },
        },
      },
      "/.well-known/agent-card.json": {
        get: {
          summary: "Tolley agent discovery card",
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
