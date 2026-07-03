import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/lead/[token]
 *
 * Status check for an agent-submitted action. Returns minimal data —
 * no PII beyond what the agent itself provided.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || !/^[A-Za-z0-9_-]{4,64}$/.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const row = await prisma.leadAction.findUnique({
    where: { receiptToken: token },
    select: {
      receiptToken: true,
      subsite: true,
      action: true,
      status: true,
      statusNote: true,
      statusUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row, {
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
