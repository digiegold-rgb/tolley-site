import { createMcpHandler } from "mcp-handler";
import { registerTools, setCurrentRequest } from "@/lib/mcp-tools";

const mcpHandler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { serverInfo: { name: "Tolley.io", version: "1.0.0" } },
  { basePath: "/api" }
);

async function handler(request: Request) {
  setCurrentRequest(request);
  return mcpHandler(request);
}

export { handler as GET, handler as POST, handler as DELETE };
