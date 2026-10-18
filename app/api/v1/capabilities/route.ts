import { publicRouteInventory } from "@/lib/company/routes";
import { capabilities } from "@/lib/company/catalog";
import { allCapabilities } from "@/lib/company/store";
export const dynamic = "force-dynamic";
export async function GET() {
  let rows = capabilities(); let dynamicAvailable = true;
  try { rows = await allCapabilities(); } catch { dynamicAvailable = false; }
  return Response.json({ version: "1", publicRoutes: publicRouteInventory(), capabilities: rows, dynamicAvailable, documentation: "/services/agent", quoteEndpoint: "/api/v1/quotes", taskEndpoint: "/api/v1/tasks", mcpEndpoint: "/api/v1/agent-mcp", authentication: "Explicitly scoped bearer key; configure in /services/agent" }, { headers: { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" } });
}
