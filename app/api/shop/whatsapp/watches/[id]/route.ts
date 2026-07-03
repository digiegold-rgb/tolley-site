import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  groupMode: z.enum(["smart", "single", "pairs"]).optional(),
  count: z.number().int().min(1).max(500).optional(),
  chatName: z.string().trim().max(120).optional(),
  // "now" re-arms the watermark to the present (skip whatever's buffered).
  resetWatermark: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let parsed;
  try {
    parsed = PatchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const watch = await prisma.whatsappWatch.update({
    where: { id },
    data: {
      enabled: parsed.enabled ?? undefined,
      groupMode: parsed.groupMode ?? undefined,
      count: parsed.count ?? undefined,
      chatName: parsed.chatName ?? undefined,
      lastSeenTs: parsed.resetWatermark ? Math.floor(Date.now() / 1000) : undefined,
      lastError: parsed.enabled ? null : undefined,
    },
  });
  return NextResponse.json({ watch });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.whatsappWatch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
