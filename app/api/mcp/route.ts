import { createMcpHandler } from "mcp-handler";
import { registerTools, withMcpRequest } from "@/lib/mcp-tools";
import { preserveWebGlobals } from "@/lib/preserve-web-globals";

const mcpHandler = preserveWebGlobals(() => createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { serverInfo: { name: "Tolley.io", version: "1.0.0" } },
  { basePath: "/api" }
));

async function handler(request: Request) {
  return withMcpRequest(request, () => mcpHandler(request));
}

export { handler as GET, handler as POST, handler as DELETE };
