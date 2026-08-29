/**
 * /api/vater/push/subscribe — browser push subscriptions for the stepped
 * create flow (2026-08-28). Pairs with public/sw.js + lib/vater/push-client.ts.
 *
 *   GET    → { publicKey } (VAPID; null when push is not configured)
 *   POST   { endpoint, keys: {p256dh, auth}, userAgent? } → upsert on endpoint
 *   DELETE { endpoint } → remove (idempotent)
 *
 * Rows are keyed on the ROOT user (resolveTenantIdentity — identity by userId
 * only, never by the tab's NULL email), so every workspace tab of one login
 * notifies the same browser and one unsubscribe clears it for all of them.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import { vapidPublicKey } from "@/lib/vater/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ENDPOINT = 2048;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { publicKey: vapidPublicKey() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

function readEndpoint(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > MAX_ENDPOINT || !/^https:\/\//.test(s)) return null;
  return s;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
    userAgent?: unknown;
  } | null;
  const endpoint = readEndpoint(body?.endpoint);
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "endpoint and keys.p256dh/keys.auth are required" }, { status: 400 });
  }
  const userAgent =
    typeof body?.userAgent === "string" && body.userAgent.trim()
      ? body.userAgent.trim().slice(0, 300)
      : req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const { rootUserId } = await resolveTenantIdentity(session.user.id);
  const sub = await prisma.vaterPushSubscription.upsert({
    where: { endpoint },
    create: { userId: rootUserId, endpoint, p256dh, auth: authKey, userAgent },
    // A browser re-subscribing under a different login takes the endpoint with it.
    update: { userId: rootUserId, p256dh, auth: authKey, userAgent },
    select: { id: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, id: sub.id, createdAt: sub.createdAt });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = readEndpoint(body?.endpoint);
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }
  const { rootUserId } = await resolveTenantIdentity(session.user.id);
  const res = await prisma.vaterPushSubscription.deleteMany({
    where: { endpoint, userId: rootUserId },
  });
  return NextResponse.json({ ok: true, removed: res.count });
}
