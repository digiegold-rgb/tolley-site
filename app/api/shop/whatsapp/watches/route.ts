import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

/** Bare phone number → JID; full JID (@s.whatsapp.net / @g.us / @lid) passes through.
 * NOTE: WhatsApp now addresses many 1:1 chats by LID (e.g. 1901...@lid), NOT the phone JID.
 * The bridge captures live messages under whatever JID WhatsApp sends — often @lid — so the
 * watch chatId must match that exactly. Prefer copying the chatId from the bridge's /chats list
 * over typing a phone number, or the watch will poll a JID the bridge never sees. */
function normalizeChatId(input: string): string {
  const t = input.trim();
  if (/@(s\.whatsapp\.net|g\.us|broadcast|lid)$/.test(t)) return t;
  const digits = t.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const watches = await prisma.whatsappWatch.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ watches });
}

const CreateSchema = z.object({
  chatId: z.string().trim().min(5).max(120),
  chatName: z.string().trim().max(120).optional(),
  groupMode: z.enum(["smart", "single", "pairs"]).optional(),
  count: z.number().int().min(1).max(500).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = CreateSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const chatId = normalizeChatId(parsed.chatId);
  // Watermark to now so a new watch only lists photos sent from here forward.
  const nowTs = Math.floor(Date.now() / 1000);

  const watch = await prisma.whatsappWatch.upsert({
    where: { chatId },
    create: {
      chatId,
      chatName: parsed.chatName || null,
      groupMode: parsed.groupMode ?? "single",
      count: parsed.count ?? 50,
      lastSeenTs: nowTs,
      enabled: true,
    },
    update: {
      chatName: parsed.chatName || undefined,
      groupMode: parsed.groupMode ?? undefined,
      count: parsed.count ?? undefined,
      enabled: true,
      lastError: null,
    },
  });
  return NextResponse.json({ watch }, { status: 201 });
}
