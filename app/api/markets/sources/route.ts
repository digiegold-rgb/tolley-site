import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * GET /api/markets/sources — List subscribed sources
 * Query: type (optional filter)
 */
export async function GET(request: NextRequest) {
  // Allow both session auth and SYNC_SECRET
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!syncOk) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const type = new URL(request.url).searchParams.get("type");
  const where: Record<string, unknown> = { active: true };
  if (type) where.type = type;

  const sources = await prisma.marketSource.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ sources });
}

/**
 * POST /api/markets/sources — Subscribe to a new source
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, name, url, identifier, checkInterval, metadata } = body;

  if (!type || !name) {
    return NextResponse.json({ error: "type and name are required" }, { status: 400 });
  }

  const source = await prisma.marketSource.create({
    data: {
      type,
      name,
      url: url || null,
      identifier: identifier || null,
      checkInterval: checkInterval || 21600,
      metadata: metadata || null,
    },
  });

  return NextResponse.json({ source }, { status: 201 });
}
