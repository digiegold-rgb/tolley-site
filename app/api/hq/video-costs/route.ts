import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PIPELINES = ["shorts", "housing", "listings", "wd", "estate", "other"] as const;
type Pipeline = (typeof PIPELINES)[number];

function isPipeline(v: unknown): v is Pipeline {
  return typeof v === "string" && (PIPELINES as readonly string[]).includes(v);
}

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function cents(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

// POST /api/hq/video-costs — the DGX pushes one row per rendered video
// (push-video-costs.mjs, x-sync-secret auth). Upsert on videoKey so the same
// ledger can be re-pushed every hour without duplicating anything.
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
    const videoKey = str(item.videoKey, 600);
    const renderedRaw = str(item.renderedAt, 40);
    const renderedAt = renderedRaw && !Number.isNaN(Date.parse(renderedRaw)) ? new Date(renderedRaw) : null;
    if (!videoKey || !isPipeline(item.pipeline) || !renderedAt) {
      skipped++;
      continue;
    }

    const row = {
      pipeline: item.pipeline,
      title: str(item.title, 300),
      template: str(item.template, 60),
      status: str(item.status, 20) ?? "draft",
      url: str(item.url, 600),
      clipsCents: cents(item.clipsCents),
      lipsyncCents: cents(item.lipsyncCents),
      imageCents: cents(item.imageCents),
      scriptCents: cents(item.scriptCents),
      ttsCents: cents(item.ttsCents),
      postCents: cents(item.postCents),
      estimated: item.estimated === true,
      renderedAt,
    };

    await prisma.videoCost.upsert({
      where: { videoKey },
      create: { videoKey, ...row },
      update: row,
    });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted, skipped });
}

interface Row {
  videoKey: string;
  pipeline: string;
  title: string | null;
  template: string | null;
  status: string;
  url: string | null;
  clipsCents: number;
  lipsyncCents: number;
  imageCents: number;
  scriptCents: number;
  ttsCents: number;
  postCents: number;
  estimated: boolean;
  renderedAt: Date;
}

function total(r: Row): number {
  return r.clipsCents + r.lipsyncCents + r.imageCents + r.scriptCents + r.ttsCents + r.postCents;
}

// GET /api/hq/video-costs?limit=60 — all-time grand total plus the rollups that
// make it readable: this month, per pipeline, per month, and what each of the
// most recent videos cost.
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const limit = Math.min(200, Math.max(10, Number(request.nextUrl.searchParams.get("limit")) || 60));

    // Small table (one row per video ever made — hundreds, not millions), so
    // one read and rollups in memory beats five aggregate round-trips.
    const rows = (await prisma.videoCost.findMany({
      orderBy: { renderedAt: "desc" },
      select: {
        videoKey: true, pipeline: true, title: true, template: true, status: true,
        url: true, clipsCents: true, lipsyncCents: true, imageCents: true, scriptCents: true,
        ttsCents: true, postCents: true, estimated: true, renderedAt: true,
      },
    })) as Row[];

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const breakdown = { clipsCents: 0, lipsyncCents: 0, imageCents: 0, scriptCents: 0, ttsCents: 0, postCents: 0 };
    const byPipeline = new Map<string, { pipeline: string; cents: number; count: number }>();
    const byMonth = new Map<string, { month: string; cents: number; count: number }>();
    let grandTotalCents = 0;
    let thisMonthCents = 0;
    let thisMonthCount = 0;
    let estimatedCents = 0;

    for (const r of rows) {
      const t = total(r);
      grandTotalCents += t;
      if (r.estimated) estimatedCents += t;
      breakdown.clipsCents += r.clipsCents;
      breakdown.lipsyncCents += r.lipsyncCents;
      breakdown.imageCents += r.imageCents;
      breakdown.scriptCents += r.scriptCents;
      breakdown.ttsCents += r.ttsCents;
      breakdown.postCents += r.postCents;

      const p = byPipeline.get(r.pipeline) ?? { pipeline: r.pipeline, cents: 0, count: 0 };
      p.cents += t;
      p.count += 1;
      byPipeline.set(r.pipeline, p);

      const m = r.renderedAt.toISOString().slice(0, 7);
      const mm = byMonth.get(m) ?? { month: m, cents: 0, count: 0 };
      mm.cents += t;
      mm.count += 1;
      byMonth.set(m, mm);

      if (m === monthKey) {
        thisMonthCents += t;
        thisMonthCount += 1;
      }
    }

    return NextResponse.json({
      grandTotalCents,
      videoCount: rows.length,
      avgCents: rows.length ? Math.round(grandTotalCents / rows.length) : 0,
      estimatedCents,
      thisMonth: { month: monthKey, cents: thisMonthCents, count: thisMonthCount },
      breakdown,
      byPipeline: Array.from(byPipeline.values()).sort((a, b) => b.cents - a.cents),
      byMonth: Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month)),
      recent: rows.slice(0, limit).map((r) => ({
        videoKey: r.videoKey,
        pipeline: r.pipeline,
        title: r.title,
        template: r.template,
        status: r.status,
        url: r.url,
        estimated: r.estimated,
        renderedAt: r.renderedAt.toISOString(),
        totalCents: total(r),
        clipsCents: r.clipsCents,
        lipsyncCents: r.lipsyncCents,
        imageCents: r.imageCents,
        scriptCents: r.scriptCents,
        postCents: r.postCents,
      })),
    });
  } catch (err) {
    console.error("[hq/video-costs GET]", err);
    return NextResponse.json({ error: "Failed to load video costs" }, { status: 500 });
  }
}
