/**
 * POST /api/webhooks/zernio
 *
 * Aggregator → us. Keeps VaterSocialPost / SocialAccount in step without
 * polling. Verified with HMAC-SHA256 over the raw body (X-Zernio-Signature)
 * when ZERNIO_WEBHOOK_SECRET is set; refuses unsigned traffic otherwise.
 * Idempotent on the event id (at-least-once delivery).
 *
 * Handled: post.published / post.partial / post.failed / post.cancelled /
 *          post.scheduled / post.platform.* / post.tiktok.url_resolved,
 *          account.connected / account.disconnected.
 * Register: Zernio dashboard → Webhooks → https://www.tolley.io/api/webhooks/zernio
 * (⚠️ www — the apex 301 eats POST bodies).
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getPost,
  summarizePost,
  syncAccountsForUser,
  VENDOR,
} from "@/lib/vater/social-vendor/zernio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const seen = new Map<string, number>(); // best-effort in-process dedupe
function remember(id: string): boolean {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 10 * 60_000) seen.delete(k);
  if (seen.has(id)) return false;
  seen.set(id, now);
  return true;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  const raw = await req.text();
  const sig = req.headers.get("x-zernio-signature") ?? req.headers.get("x-late-signature");
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 401 });
  }
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 401 });
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let payload: {
    id?: string;
    event?: string;
    post?: { id?: string; metadata?: { projectId?: string; userId?: string } };
    account?: { accountId?: string; profileId?: string; platform?: string };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const evId = payload.id ?? req.headers.get("x-zernio-event-id") ?? "";
  if (evId && !remember(evId)) return NextResponse.json({ ok: true, dup: true });

  const event = payload.event ?? "";
  try {
    if (event.startsWith("post.") && payload.post?.id) {
      const row = await prisma.vaterSocialPost.findUnique({
        where: { externalPostId: payload.post.id },
        select: { id: true },
      });
      if (row) {
        // Re-read the canonical post rather than trusting a partial payload.
        const p = await getPost(payload.post.id);
        const s = summarizePost(p);
        await prisma.vaterSocialPost.update({
          where: { id: row.id },
          data: {
            status: s.status,
            platforms: s.platforms,
            publishedAt: s.publishedAt,
            scheduledFor: s.scheduledFor,
            lastError: s.lastError,
          },
        });
      }
    } else if (event.startsWith("account.") && payload.account?.profileId) {
      const prof = await prisma.vaterSocialProfile.findFirst({
        where: { vendor: VENDOR, externalProfileId: payload.account.profileId },
        select: { userId: true },
      });
      if (prof) await syncAccountsForUser(prof.userId);
    }
  } catch (err) {
    // Ack anyway — the read-side refresh in /api/vater/social-posts is the
    // safety net; a 5xx here just makes Zernio retry the same event.
    console.error("[webhooks/zernio] handler error:", err);
  }
  return NextResponse.json({ ok: true });
}
