import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET/PUT/DELETE /api/content/templates/[id]
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth =
    req.headers.get("x-sync-secret") ||
    req.nextUrl.searchParams.get("key");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const template = await prisma.contentTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const template = await prisma.contentTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.platform !== undefined && { platform: body.platform }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.promptTemplate !== undefined && { promptTemplate: body.promptTemplate }),
      ...(body.bodyTemplate !== undefined && { bodyTemplate: body.bodyTemplate }),
      ...(body.hashtagStrategy !== undefined && { hashtagStrategy: body.hashtagStrategy }),
      ...(body.mediaStrategy !== undefined && { mediaStrategy: body.mediaStrategy }),
      ...(body.tone !== undefined && { tone: body.tone }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({ template });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.contentTemplate.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
