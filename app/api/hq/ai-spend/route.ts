import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

// POST /api/hq/ai-spend — the DGX collector pushes one row per provider daily
// (collect-ai-spend.mjs, x-sync-secret auth). Upsert on provider, so re-runs
// never duplicate. amountCents is LIFETIME cash out for that provider.
export async function POST(request: NextRequest) {
  const header = request.headers.get("x-sync-secret");
  if (!header || !secretEquals(header, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an array" }, { status: 400 });
  }

  let upserted = 0;
  let skipped = 0;
  for (const raw of body) {
    if (!raw || typeof raw !== "object") {
      skipped++;
      continue;
    }
    const item = raw as Record<string, unknown>;
    const provider = str(item.provider, 40)?.toLowerCase() ?? null;
    const label = str(item.label, 120);
    const amountCents = Number(item.amountCents);
    const asOfRaw = str(item.asOf, 40);
    const asOf = asOfRaw && !Number.isNaN(Date.parse(asOfRaw)) ? new Date(asOfRaw) : new Date();
    if (!provider || !label || !Number.isFinite(amountCents) || amountCents < 0) {
      skipped++;
      continue;
    }

    const row = {
      label,
      amountCents: Math.round(amountCents),
      kind: str(item.kind, 20) === "estimated" ? "estimated" : "verified",
      note: str(item.note, 500),
      asOf,
    };

    await prisma.aiSpendLive.upsert({
      where: { provider },
      create: { provider, ...row },
      update: row,
    });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted, skipped });
}

// GET /api/hq/ai-spend — live provider rows for the /hq AI P&L pill.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await prisma.aiSpendLive.findMany({ orderBy: { provider: "asc" } });
    return NextResponse.json({
      rows: rows.map((r) => ({
        provider: r.provider,
        label: r.label,
        amountCents: r.amountCents,
        kind: r.kind,
        note: r.note,
        asOf: r.asOf.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[hq/ai-spend GET]", err);
    return NextResponse.json({ error: "Failed to load AI spend" }, { status: 500 });
  }
}
