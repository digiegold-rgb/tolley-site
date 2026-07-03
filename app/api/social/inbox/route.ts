import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import {
  FB_PAGES,
  getPageToken,
  getPageConversations,
  sendPageReply,
} from "@/lib/facebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface InboxItem {
  conversationId: string;
  pageId: string;
  pageName: string;
  updatedTime: string;
  preview: string;
  fromName: string;
  fromId: string;
  unread: boolean;
}

let cache: { ts: number; items: InboxItem[] } | null = null;
const TTL_MS = 60 * 1000;

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) {
    return NextResponse.json({ items: cache.items, cachedAt: new Date(cache.ts).toISOString() });
  }

  // Fan out to all configured pages in parallel — each page's
  // getPageConversations does multiple Graph calls per conversation, and
  // serial walking blew our 60s budget on cold starts.
  const items: InboxItem[] = [];
  const configured = FB_PAGES
    .map((page) => ({ page, token: getPageToken(page) }))
    .filter((p): p is { page: typeof FB_PAGES[number]; token: string } => Boolean(p.token));

  const results = await Promise.allSettled(
    configured.map(({ page, token }) => getPageConversations(page.id, token, 5)),
  );

  for (let i = 0; i < configured.length; i += 1) {
    const settled = results[i];
    if (settled.status !== "fulfilled") continue;
    const { page } = configured[i];
    for (const convo of settled.value) {
      const lastMsg = convo.messages[0];
      const fromOther = convo.messages.find((m) => m.from.id !== page.id);
      items.push({
        conversationId: convo.id,
        pageId: page.id,
        pageName: page.name,
        updatedTime: convo.updatedTime,
        preview: lastMsg?.message?.slice(0, 200) ?? "(no message)",
        fromName: fromOther?.from.name ?? lastMsg?.from.name ?? "Unknown",
        fromId: fromOther?.from.id ?? lastMsg?.from.id ?? "",
        unread: lastMsg ? lastMsg.from.id !== page.id : false,
      });
    }
  }

  items.sort((a, b) => new Date(b.updatedTime).getTime() - new Date(a.updatedTime).getTime());

  cache = { ts: now, items };
  return NextResponse.json({ items, cachedAt: new Date(now).toISOString() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    pageId?: string;
    recipientId?: string;
    message?: string;
  };
  if (!body.pageId || !body.recipientId || !body.message) {
    return NextResponse.json(
      { error: "pageId, recipientId, message required" },
      { status: 400 },
    );
  }

  const page = FB_PAGES.find((p) => p.id === body.pageId);
  if (!page) return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  const token = getPageToken(page);
  if (!token) return NextResponse.json({ error: "No page token" }, { status: 503 });

  try {
    const result = await sendPageReply(page.id, token, body.recipientId, body.message);
    cache = null; // bust cache so the inbox refresh picks up the sent message
    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "send failed" },
      { status: 502 },
    );
  }
}
