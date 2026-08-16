/**
 * GET /api/v1/mcp — Model Context Protocol tool manifest for Jelly Studio.
 *
 * A minimal, static descriptor: it tells an MCP client (or any LLM agent)
 * which three tools exist, what arguments they take, and which HTTP call each
 * one maps to. It is NOT a JSON-RPC MCP server — there is no session, no
 * `initialize`, no stdio transport. Adding those would mean a second auth
 * surface over the same three endpoints; this way an agent reads one document
 * and then speaks plain HTTP with the key it already has.
 *
 * Deliberately UNAUTHENTICATED. A manifest that requires a key to discover how
 * to send a key is a chicken-and-egg problem, and the document contains no
 * secrets — only the shapes that /llms.txt already describes in prose. Every
 * tool it names still refuses to do anything without a valid bearer key.
 *
 * `endpoint` values are absolute so an agent can act on them without knowing
 * where it fetched the manifest from.
 */

import { NextResponse } from "next/server";

import { publicSiteUrl } from "@/lib/vater/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const base = publicSiteUrl();

  return NextResponse.json(
    {
      schemaVersion: "2026-08-16",
      name: "jelly-studio",
      title: "Jelly Studio",
      description:
        "Turn a written script into a finished faceless video: cloned narration, generated cinematic scenes, burned-in captions. Renders take roughly 10-40 minutes and are billed at cost plus a per-minute ops fee (typically $1-7 for a long-form video).",
      documentation: `${base}/llms.txt`,
      auth: {
        type: "http",
        scheme: "bearer",
        description:
          "Create a key in Jelly Studio → API Keys and send it as `Authorization: Bearer jly_live_…` on every request.",
      },
      tools: [
        {
          name: "create_video",
          description:
            "Submit a script and start a render. Returns immediately with an id; the video is not finished yet. Costs money — the caller's prepaid balance is charged when the render completes.",
          endpoint: `${base}/api/v1/videos`,
          method: "POST",
          inputSchema: {
            type: "object",
            required: ["script"],
            properties: {
              script: {
                type: "string",
                description:
                  "The narration, verbatim. Minimum 20 words. This is spoken as written — it is not rewritten, summarised, or expanded.",
              },
              title: {
                type: "string",
                description:
                  "Optional. Defaults to the script's first line, trimmed to 12 words.",
              },
              styleId: {
                type: "string",
                description:
                  "Optional. A style id owned by the caller or a system style. Defaults to the account's locked style.",
              },
              features: {
                type: "object",
                description:
                  "Optional render settings: captionPreset, aspect ('16:9' | '9:16'), language, motionMode ('draft' | 'full'), cameraDefault, transitionSec, brandKit. Unknown keys are ignored.",
              },
            },
          },
          outputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Video id — pass this to get_video." },
              status: { type: "string" },
              pollUrl: { type: "string" },
            },
          },
        },
        {
          name: "get_video",
          description:
            "Read the current state of a render: status, phase, queue position, the finished URL once it exists, and the itemised cost. This is the authoritative source — webhooks are a convenience, not a guarantee.",
          endpoint: `${base}/api/v1/videos/{id}`,
          method: "GET",
          inputSchema: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", description: "The id returned by create_video." },
            },
          },
          outputSchema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                description:
                  "draft | scripted | generating_audio | generating_scenes | composing_video | ready | failed",
              },
              phase: { type: "string", nullable: true },
              progress: { type: "number" },
              queuePosition: { type: "number", nullable: true },
              finalUrl: { type: "string", nullable: true },
              error: { type: "string", nullable: true },
              receipt: { type: "object" },
            },
          },
        },
        {
          name: "status",
          description:
            "Check whether the renderer is up and how many jobs are ahead of you. Use it to decide whether to submit now or wait.",
          endpoint: `${base}/api/v1/status`,
          method: "GET",
          inputSchema: { type: "object", properties: {} },
          outputSchema: {
            type: "object",
            properties: {
              ok: {
                type: "boolean",
                description: "false means the renderer is unreachable — do not submit.",
              },
              queue: { type: "object", nullable: true },
            },
          },
        },
      ],
      webhooks: {
        description:
          "Set a webhook URL on your key to be POSTed when a render finishes or fails, instead of polling.",
        events: ["video.ready", "video.failed"],
        signature:
          "X-Jelly-Signature: sha256=<HMAC-SHA256 of the raw body, keyed with the hex SHA-256 of your API key>",
      },
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
