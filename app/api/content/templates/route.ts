import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/content/templates — list templates
 * POST /api/content/templates — create template
 */

export async function GET(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth =
    req.headers.get("x-sync-secret") ||
    req.nextUrl.searchParams.get("key");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriberId = req.nextUrl.searchParams.get("subscriberId");
  const platform = req.nextUrl.searchParams.get("platform");
  const category = req.nextUrl.searchParams.get("category");

  const where: Record<string, unknown> = {
    isActive: true,
    OR: [
      { subscriberId: null }, // system defaults
      ...(subscriberId ? [{ subscriberId }] : []),
    ],
  };
  if (platform && platform !== "all") where.platform = platform;
  if (category) where.category = category;

  const templates = await prisma.contentTemplate.findMany({
    where,
    orderBy: [{ subscriberId: "asc" }, { category: "asc" }],
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { subscriberId, name, platform, category, promptTemplate, bodyTemplate, hashtagStrategy, mediaStrategy, tone } = body;

  if (!name || !platform || !category || !promptTemplate) {
    return NextResponse.json(
      { error: "name, platform, category, promptTemplate required" },
      { status: 400 }
    );
  }

  const template = await prisma.contentTemplate.create({
    data: {
      subscriberId: subscriberId || null,
      name,
      platform,
      category,
      promptTemplate,
      bodyTemplate: bodyTemplate || null,
      hashtagStrategy: hashtagStrategy || null,
      mediaStrategy: mediaStrategy || null,
      tone: tone || "professional",
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
