/**
 * GET    /api/vater/youtube/custom-art-styles/[id]
 * DELETE /api/vater/youtube/custom-art-styles/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const cas = await prisma.customArtStyle.findUnique({ where: { id } });
  if (!cas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cas.userId && cas.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ customArtStyle: cas });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const cas = await prisma.customArtStyle.findUnique({ where: { id } });
  if (!cas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cas.userId && cas.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Styles referencing this CAS get customArtStyleId set to NULL via the
  // schema's onDelete: SetNull. Safe to delete the CAS row.
  await prisma.customArtStyle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
