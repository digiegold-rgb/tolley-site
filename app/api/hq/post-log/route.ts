import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";
import { computeHealth, SCHEDULED_JOBS } from "@/lib/post-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cookie (Jared in /hq) OR x-sync-secret (DGX posting jobs writing their results).
async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

const STATUSES = new Set(["ok", "fail", "skipped"]);

function str(v: unknown, max = 500): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

// POST /api/hq/post-log — jobs report one run's results.
// Body: { job, runId?, title?, business?, entries: [{channel, status, account?,
//         url?, error?, costCents?, firedAt?}] }
export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const job = str(body?.job, 80);
    if (!job) {
      return NextResponse.json({ error: "job is required" }, { status: 400 });
    }
    const rawEntries = Array.isArray(body?.entries) ? body.entries : [];
    if (!rawEntries.length) {
      return NextResponse.json({ error: "entries[] is required" }, { status: 400 });
    }

    // One runId ties every channel of a fan-out together so the tab can show
    // "this post went to 8 places" instead of 8 unrelated lines.
    const runId = str(body?.runId, 80) ?? `${job}-${Date.now()}`;
    const runTitle = str(body?.title, 300);
    const runBusiness = str(body?.business, 40);

    const data = rawEntries.flatMap((e: Record<string, unknown>) => {
      const channel = str(e?.channel, 40);
      const status = str(e?.status, 20);
      if (!channel || !status || !STATUSES.has(status)) return [];
      const firedRaw = str(e?.firedAt, 40);
      const fired = firedRaw ? new Date(firedRaw) : new Date();
      const cost = Number(e?.costCents);
      return [
        {
          job,
          runId,
          channel,
          status,
          account: str(e?.account, 120),
          business: str(e?.business, 40) ?? runBusiness,
          title: str(e?.title, 300) ?? runTitle,
          url: str(e?.url, 600),
          error: str(e?.error, 2000),
          costCents: Number.isFinite(cost) && cost > 0 ? Math.round(cost) : 0,
          firedAt: Number.isNaN(fired.getTime()) ? new Date() : fired,
        },
      ];
    });

    if (!data.length) {
      return NextResponse.json({ error: "no valid entries" }, { status: 400 });
    }

    await prisma.postLogEntry.createMany({ data });

    // Keep the ledger bounded — 90 days is enough to spot a channel that has
    // been quietly dead for a month, which is the longest gap worth catching.
    const cutoff = new Date(Date.now() - 90 * 24 * 3_600_000);
    await prisma.postLogEntry.deleteMany({ where: { firedAt: { lt: cutoff } } });

    return NextResponse.json({ ok: true, runId, written: data.length });
  } catch (err) {
    console.error("[hq/post-log POST]", err);
    return NextResponse.json({ error: "Failed to write post log" }, { status: 500 });
  }
}

// GET /api/hq/post-log?days=7 — recent runs, per-channel health, cost rollup.
export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const days = Math.min(
      90,
      Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 7),
    );
    const since = new Date(Date.now() - days * 24 * 3_600_000);

    const entries = await prisma.postLogEntry.findMany({
      where: { firedAt: { gte: since } },
      orderBy: { firedAt: "desc" },
      take: 1000,
    });

    // Health must look further back than the display window: a channel dark for
    // 30 days has nothing inside a 7-day window, and "no rows" would otherwise
    // read as "nothing to report" — the exact blind spot this tab replaces.
    const healthRows = await prisma.postLogEntry.findMany({
      where: { firedAt: { gte: new Date(Date.now() - 90 * 24 * 3_600_000) } },
      orderBy: { firedAt: "desc" },
      select: { job: true, channel: true, status: true, firedAt: true, url: true, error: true },
    });
    const health = computeHealth(healthRows);

    // Group the display window into runs so one short reads as one row with 8
    // channel chips under it.
    const runs = new Map<
      string,
      {
        runId: string;
        job: string;
        title: string | null;
        firedAt: string;
        costCents: number;
        channels: typeof entries;
      }
    >();
    for (const e of entries) {
      const r = runs.get(e.runId);
      if (r) {
        r.channels.push(e);
        r.costCents += e.costCents;
        if (e.firedAt.toISOString() > r.firedAt) r.firedAt = e.firedAt.toISOString();
      } else {
        runs.set(e.runId, {
          runId: e.runId,
          job: e.job,
          title: e.title,
          firedAt: e.firedAt.toISOString(),
          costCents: e.costCents,
          channels: [e],
        });
      }
    }

    const costByChannel: Record<string, number> = {};
    for (const e of entries) {
      if (e.costCents > 0) costByChannel[e.channel] = (costByChannel[e.channel] ?? 0) + e.costCents;
    }

    return NextResponse.json({
      days,
      runs: Array.from(runs.values()).sort((a, b) => b.firedAt.localeCompare(a.firedAt)),
      health,
      summary: {
        posts: entries.length,
        ok: entries.filter((e) => e.status === "ok").length,
        failed: entries.filter((e) => e.status === "fail").length,
        skipped: entries.filter((e) => e.status === "skipped").length,
        costCents: entries.reduce((s, e) => s + e.costCents, 0),
        costByChannel,
        problems: health.filter((h) => h.status !== "ok").length,
        declaredChannels: SCHEDULED_JOBS.reduce((s, j) => s + j.channels.length, 0),
      },
    });
  } catch (err) {
    console.error("[hq/post-log GET]", err);
    return NextResponse.json({ error: "Failed to load post log" }, { status: 500 });
  }
}
