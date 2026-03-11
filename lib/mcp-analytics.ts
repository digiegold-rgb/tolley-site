import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function logInvocation(
  tool: string,
  input: unknown,
  request: Request
): void {
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  // Fire-and-forget — never blocks MCP response
  prisma.mcpInvocation
    .create({
      data: {
        tool,
        input: input as object ?? undefined,
        userAgent,
        ip,
      },
    })
    .catch((err) => {
      console.error("[mcp-analytics] Failed to log invocation:", err);
    });
}

export async function getInvocationStats(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await prisma.$queryRaw<
    { tool: string; count: bigint }[]
  >`SELECT tool, COUNT(*) as count FROM "McpInvocation" WHERE "createdAt" >= ${since} GROUP BY tool ORDER BY count DESC`;

  return results.map((r) => ({ tool: r.tool, count: Number(r.count) }));
}
