import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const dynamic = "force-dynamic";

/**
 * Nightly repricer run reporting.
 *
 * POST — HMAC-signed (same x-fb-mirror-* header scheme as fb-verify) from the
 * DGX fb-draft-worker after each reprice run. Persists one RepriceEvent per
 * touched listing so the dashboard can show "what dropped last night".
 *
 * GET — shop-admin only. Returns events from the last `hours` (default 36)
 * plus rollup counts for the dashboard tracker panel.
 */

interface ReportEvent {
  productId?: string | null;
  title: string;
  fromPrice: number;
  toPrice: number;
  status: "dropped" | "gone" | "failed";
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret =
    process.env.MIRROR_SYNC_SECRET || process.env.FB_DRAFT_SECRET || "";
  if (!secret) return false;
  const sig = req.headers.get("x-fb-mirror-signature") || "";
  const expStr = req.headers.get("x-fb-mirror-expires") || "";
  const expires = parseInt(expStr, 10);
  if (!sig || !Number.isFinite(expires) || Date.now() > expires) return false;
  const expected = createHmac("sha256", secret)
    .update(`${expires}.${rawBody}`)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: { events?: ReportEvent[]; runAt?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const events = (payload.events || []).filter(
    (e) =>
      e &&
      typeof e.title === "string" &&
      typeof e.fromPrice === "number" &&
      typeof e.toPrice === "number"
  );
  if (events.length === 0) {
    return NextResponse.json({ ok: true, created: 0 });
  }
  const runAt = payload.runAt ? new Date(payload.runAt) : new Date();
  const result = await prisma.repriceEvent.createMany({
    data: events.map((e) => ({
      productId: e.productId || null,
      title: e.title.slice(0, 200),
      fromPrice: e.fromPrice,
      toPrice: e.toPrice,
      status: ["dropped", "gone", "failed"].includes(e.status)
        ? e.status
        : "dropped",
      runAt,
    })),
  });
  return NextResponse.json({ ok: true, created: result.count });
}

export async function GET(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const hours = Math.min(
    24 * 14,
    parseInt(searchParams.get("hours") || "36", 10) || 36
  );
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const events = await prisma.repriceEvent.findMany({
    where: { runAt: { gte: since } },
    orderBy: { runAt: "desc" },
    take: 500,
  });
  const dropped = events.filter((e) => e.status === "dropped");
  return NextResponse.json({
    since: since.toISOString(),
    counts: {
      dropped: dropped.length,
      gone: events.filter((e) => e.status === "gone").length,
      failed: events.filter((e) => e.status === "failed").length,
      totalDiscount: Math.round(
        dropped.reduce((s, e) => s + (e.fromPrice - e.toPrice), 0)
      ),
    },
    lastRunAt: events[0]?.runAt ?? null,
    events,
  });
}
