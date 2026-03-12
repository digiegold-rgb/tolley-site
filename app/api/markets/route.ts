import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * GET /api/markets — List data points (public for basic, auth for full)
 * Query: type, scope, days, limit, fields
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const scope = searchParams.get("scope");
  const days = parseInt(searchParams.get("days") || "30");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const fields = searchParams.get("fields");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (scope) where.scope = scope;
  if (days > 0) {
    where.createdAt = { gte: new Date(Date.now() - days * 86400000) };
  }

  const select = fields === "url"
    ? { url: true }
    : {
        id: true,
        type: true,
        title: true,
        url: true,
        scope: true,
        sentiment: true,
        signal: true,
        signalConfidence: true,
        summary: true,
        analysis: true,
        numericValue: true,
        previousValue: true,
        changePercent: true,
        publishedAt: true,
        tags: true,
        createdAt: true,
      };

  const dataPoints = await prisma.marketDataPoint.findMany({
    where,
    select,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ dataPoints, count: dataPoints.length });
}

/**
 * POST /api/markets/ingest — Manual input dispatch
 * Body: { type: "youtube" | "article" | "note", url?, text?, sourceId? }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, url, text, title } = body;

  if (type === "youtube" && url) {
    // Dispatch to worker
    const workerUrl = process.env.MARKET_WORKER_URL || "http://localhost:8901";
    try {
      const res = await fetch(`${workerUrl}/collect/youtube`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": process.env.SYNC_SECRET || "",
        },
        body: JSON.stringify({ url }),
      });
      const result = await res.json();
      return NextResponse.json({ ok: true, dispatched: "youtube", ...result });
    } catch (e) {
      return NextResponse.json({ error: `Worker unreachable: ${e}` }, { status: 502 });
    }
  }

  if (type === "article" && url) {
    const workerUrl = process.env.MARKET_WORKER_URL || "http://localhost:8901";
    try {
      const res = await fetch(`${workerUrl}/collect/article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": process.env.SYNC_SECRET || "",
        },
        body: JSON.stringify({ url }),
      });
      const result = await res.json();
      return NextResponse.json({ ok: true, dispatched: "article", ...result });
    } catch (e) {
      return NextResponse.json({ error: `Worker unreachable: ${e}` }, { status: 502 });
    }
  }

  if (type === "note" && text) {
    // Create manual note directly
    const dp = await prisma.marketDataPoint.create({
      data: {
        type: "manual_note",
        title: title || "Manual Note",
        scope: "national",
        rawContent: text,
        summary: text.substring(0, 500),
        tags: ["manual"],
      },
    });
    return NextResponse.json({ ok: true, dataPoint: dp });
  }

  return NextResponse.json({ error: "Invalid type or missing fields" }, { status: 400 });
}
