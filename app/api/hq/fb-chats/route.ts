import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// FB Messenger auto-reply feed. Events land as SiteEvent rows (site "hq",
// event "fb_chat") — no dedicated table needed. POST = DGX bot (x-sync-secret),
// GET = Jared's /hq Chats tab (PIN cookie).

interface FbChatBody {
  pageId: string;
  pageName: string;
  conversationId: string;
  userId: string;
  message: string;
  reply?: string | null;
  // faq = matched canned answer · ack = generic acknowledgement ·
  // notify = no reply sent (Telegram-only) · fail = send attempt failed
  kind: "faq" | "ack" | "notify" | "fail";
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret");
  if (!secret || !secretEquals(secret, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as FbChatBody;
  if (!body?.pageId || !body?.userId || typeof body.message !== "string") {
    return NextResponse.json({ error: "pageId, userId, message required" }, { status: 400 });
  }
  const row = await prisma.siteEvent.create({
    data: {
      site: "hq",
      path: "/hq?tab=chats",
      event: "fb_chat",
      label: body.pageName?.slice(0, 80) ?? body.pageId,
      meta: {
        pageId: body.pageId,
        conversationId: body.conversationId ?? null,
        userId: body.userId,
        message: body.message.slice(0, 1500),
        reply: body.reply?.slice(0, 1500) ?? null,
        kind: body.kind ?? "notify",
      },
    },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function GET(req: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 300);
  const rows = await prisma.siteEvent.findMany({
    where: { event: "fb_chat" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, label: true, meta: true, createdAt: true },
  });
  return NextResponse.json({
    chats: rows.map((r) => ({ id: r.id, page: r.label, at: r.createdAt, ...(r.meta as object) })),
  });
}
