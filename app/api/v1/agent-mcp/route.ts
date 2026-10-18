import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { principal, endpoint, body } from "@/lib/company/auth";
import { allCapabilities, makeQuote, createTask, getTask, cancelTask, knowledge, taskView } from "@/lib/company/store";
import { CompanyError } from "@/lib/company/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) { return endpoint(async () => {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new CompanyError("origin_not_allowed", 403);
  const p = await principal(req, "tasks:read");
  const parsedBody = await body(req);
  const server = new McpServer({ name: "Tolley Company", version: "1.0.0" });
  const result = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }] });
  const writing = () => { if (!p.scopes.includes("tasks:write")) throw new CompanyError("scope_required", 403); };
  server.tool("list_capabilities", "List verified public capabilities and input schemas.", {}, async () => result(await allCapabilities()));
  server.tool("quote_task", "Quote work without starting or charging it.", { capabilityId: z.string(), input: z.record(z.string(), z.unknown()) }, async v => { writing(); return result(await makeQuote(p, v)); });
  server.tool("create_task", "Authorize a quoted task. May spend prepaid funds up to maxCents. Reuse idempotencyKey on retries.", { quoteId: z.string(), maxCents: z.number().int().nonnegative(), idempotencyKey: z.string() }, async ({ idempotencyKey, ...v }) => { writing(); return result(taskView(await createTask(p, idempotencyKey, v))); });
  server.tool("get_task", "Read your task, result and receipt.", { id: z.string() }, async v => result(await getTask(p, v.id)));
  server.tool("cancel_task", "Request cancellation; running provider work must first be reconciled.", { id: z.string() }, async v => { writing(); return result(await cancelTask(p, v.id)); });
  server.tool("search_knowledge", "Search public lessons and your own customer context.", { question: z.string().max(300) }, async v => { if (!p.scopes.includes("knowledge:read")) throw new CompanyError("scope_required", 403); return result(await knowledge(p.userId, v.question)); });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try { const response = await transport.handleRequest(req, { parsedBody }); response.headers.set("Cache-Control", "private, no-store"); return response; } finally { await server.close(); }
}); }
