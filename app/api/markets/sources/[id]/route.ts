import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/markets/sources/[id] — Update a source
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const source = await prisma.marketSource.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.identifier !== undefined && { identifier: body.identifier }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.checkInterval !== undefined && { checkInterval: body.checkInterval }),
      ...(body.metadata !== undefined && { metadata: body.metadata }),
    },
  });

  return NextResponse.json({ source });
}

/**
 * DELETE /api/markets/sources/[id] — Remove a source
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.marketSource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
