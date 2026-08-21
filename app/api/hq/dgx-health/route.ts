import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hq/dgx-health — the DGX pushes live vitals every 30s
// (dgx-health-push.sh, x-sync-secret auth). Single-row upsert.
export async function POST(request: NextRequest) {
  const header = request.headers.get("x-sync-secret");
  if (!header || !secretEquals(header, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();
  if (raw.length > 32_768) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as { version?: unknown; payload?: unknown };
  if (b?.version !== 1 || typeof b?.payload !== "object" || b.payload === null) {
    return NextResponse.json({ error: "version 1 + payload required" }, { status: 400 });
  }

  await prisma.dgxHealth.upsert({
    where: { id: 1 },
    create: { id: 1, payload: b.payload as object },
    update: { payload: b.payload as object, updatedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

// GET — the /hq banner polls this. Admin-gated: vitals name live infra
// (ports, models, queues) and must not be public.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await prisma.dgxHealth.findUnique({ where: { id: 1 } });
  if (!row) return NextResponse.json({ payload: null, updatedAt: null });
  return NextResponse.json({ payload: row.payload, updatedAt: row.updatedAt.toISOString() });
}
