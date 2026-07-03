import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

const BodySchema = z.object({
  // Full JID (15551234567@s.whatsapp.net / 12036...@g.us) or a bare phone
  // number — the bridge normalizes a bare number to a JID.
  chatId: z.string().trim().min(5).max(120),
  chatName: z.string().trim().max(120).optional(),
  count: z.number().int().min(1).max(500).optional(),
  // "smart" = group multi-angle shots of one item; "single" = one listing per
  // photo (right for bin-store / mixed-item batches and forwarded photo dumps);
  // "pairs" = box photo(s) then the Amazon screenshot for that item, repeat.
  groupMode: z.enum(["smart", "single", "pairs"]).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  // The bulk-ingest-worker on the DGX drains this row: it pulls the chat's
  // photos from the local WhatsApp bridge, groups them, uploads to Blob, and
  // fans out into BulkIngestJob rows that become Products + FB drafts.
  const job = await prisma.whatsappScanJob.create({
    data: {
      chatId: parsed.chatId,
      chatName: parsed.chatName || null,
      count: parsed.count ?? 50,
      groupMode: parsed.groupMode ?? "smart",
      status: "queued",
    },
    select: { id: true, chatId: true, chatName: true, count: true, status: true, createdAt: true },
  });

  return NextResponse.json({ scan: job }, { status: 201 });
}
