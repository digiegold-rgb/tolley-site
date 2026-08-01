import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";
import { VIEW_CHANNELS, CHANNEL_KEYS } from "@/lib/view-counter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hq/view-counter — the DGX pushes snapshot + daily rows hourly
// (collect.mjs, x-sync-secret auth). Upsert on channelKey+day; a null field in
// the payload never clobbers a value an earlier push already recorded, so the
// hourly snapshot push and the daily-series backfill can share days safely.
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
    if (!raw || typeof raw !== "object") { skipped++; continue; }
    const item = raw as Record<string, unknown>;
    const channelKey = typeof item.channelKey === "string" ? item.channelKey : "";
    const dayRaw = typeof item.day === "string" ? item.day : "";
    const dayMs = Date.parse(dayRaw);
    if (!CHANNEL_KEYS.has(channelKey) || Number.isNaN(dayMs)) { skipped++; continue; }
    const d = new Date(dayMs);
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    const totalViews =
      item.totalViews === null || item.totalViews === undefined ? null : BigInt(Math.round(Number(item.totalViews)));
    const dayViews =
      item.dayViews === null || item.dayViews === undefined ? null : Math.max(0, Math.round(Number(item.dayViews)));
    const subscribers =
      item.subscribers === null || item.subscribers === undefined ? null : Math.max(0, Math.round(Number(item.subscribers)));

    await prisma.channelViewStat.upsert({
      where: { channelKey_day: { channelKey, day } },
      create: { channelKey, day, totalViews, dayViews, subscribers },
      update: {
        ...(totalViews !== null ? { totalViews } : {}),
        ...(dayViews !== null ? { dayViews } : {}),
        ...(subscribers !== null ? { subscribers } : {}),
        pulledAt: new Date(),
      },
    });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted, skipped });
}

interface WindowStat {
  views: number | null;
  partial: boolean; // true when history doesn't reach the window start
  since: string | null; // where coverage actually begins, when partial
}

const WINDOWS = [30, 90, 365] as const;

// GET /api/hq/view-counter — everything the counter UI renders. Per channel:
// lifetime views, subscribers with 1d/7d deltas, and 30/90/365d view windows.
// Window math prefers the exact method available per platform: cumulative
// deltas for YouTube (lifetime counter snapshots), summed daily series for
// Facebook (no lifetime counter exists). See lib/view-counter.ts for the
// contentSince rule that makes brand-new channels show full numbers on day one.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.channelViewStat.findMany({
      orderBy: { day: "asc" },
    });
    const byChannel = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byChannel.get(r.channelKey) ?? [];
      list.push(r);
      byChannel.set(r.channelKey, list);
    }

    const now = Date.now();
    const channels = VIEW_CHANNELS.map((cfg) => {
      const hist = byChannel.get(cfg.key) ?? [];
      const snaps = hist.filter((r) => r.totalViews !== null);
      const dailies = hist.filter((r) => r.dayViews !== null);
      const subs = hist.filter((r) => r.subscribers !== null);

      const latestSnap = snaps[snaps.length - 1] ?? null;
      const lifetimeViews =
        latestSnap?.totalViews !== null && latestSnap?.totalViews !== undefined
          ? Number(latestSnap.totalViews)
          : dailies.length
            ? dailies.reduce((s, r) => s + (r.dayViews ?? 0), 0)
            : null;

      const latestSubs = subs[subs.length - 1]?.subscribers ?? null;
      const subAt = (daysAgo: number): number | null => {
        const cutoff = now - daysAgo * 86400_000;
        // last reading at or before the cutoff — the honest "what was it then"
        const past = subs.filter((r) => r.day.getTime() <= cutoff);
        return past[past.length - 1]?.subscribers ?? null;
      };
      const sub1d = subAt(1);
      const sub7d = subAt(7);

      const contentSinceMs = cfg.contentSince ? Date.parse(cfg.contentSince) : null;

      const windows: Record<string, WindowStat> = {};
      for (const days of WINDOWS) {
        const startMs = now - days * 86400_000;

        // Exact when a lifetime snapshot exists from before the window opened.
        const baseline = snaps.filter((r) => r.day.getTime() <= startMs).pop();
        if (baseline && latestSnap) {
          windows[`d${days}`] = {
            views: Number(latestSnap.totalViews) - Number(baseline.totalViews),
            partial: false,
            since: null,
          };
          continue;
        }
        // All content newer than the window start → lifetime IS the window.
        if (contentSinceMs && contentSinceMs >= startMs && lifetimeViews !== null) {
          windows[`d${days}`] = { views: lifetimeViews, partial: false, since: null };
          continue;
        }
        // Daily series (FB insights / YT Analytics backfill).
        const inWindow = dailies.filter((r) => r.day.getTime() >= startMs);
        if (inWindow.length > 0) {
          const first = inWindow[0].day.getTime();
          const partial = dailies.length === inWindow.length && first > startMs + 2 * 86400_000;
          windows[`d${days}`] = {
            views: inWindow.reduce((s, r) => s + (r.dayViews ?? 0), 0),
            partial,
            since: partial ? inWindow[0].day.toISOString().slice(0, 10) : null,
          };
          continue;
        }
        // Only snapshots inside the window: views since tracking began.
        const firstSnap = snaps[0];
        if (firstSnap && latestSnap && firstSnap.id !== latestSnap.id) {
          windows[`d${days}`] = {
            views: Number(latestSnap.totalViews) - Number(firstSnap.totalViews),
            partial: true,
            since: firstSnap.day.toISOString().slice(0, 10),
          };
          continue;
        }
        windows[`d${days}`] = { views: null, partial: true, since: null };
      }

      return {
        key: cfg.key,
        platform: cfg.platform,
        label: cfg.label,
        note: cfg.note ?? null,
        url: cfg.url,
        lifetimeViews,
        subscribers: latestSubs,
        subDelta1d: latestSubs !== null && sub1d !== null ? latestSubs - sub1d : null,
        subDelta7d: latestSubs !== null && sub7d !== null ? latestSubs - sub7d : null,
        windows,
        lastPulledAt: hist.length ? hist[hist.length - 1].pulledAt.toISOString() : null,
      };
    });

    const totals: Record<string, { views: number; partial: boolean }> = {};
    for (const days of WINDOWS) {
      const k = `d${days}`;
      totals[k] = {
        views: channels.reduce((s, c) => s + (c.windows[k]?.views ?? 0), 0),
        partial: channels.some((c) => c.windows[k]?.partial && (c.windows[k]?.views ?? 0) > 0),
      };
    }
    totals.lifetime = {
      views: channels.reduce((s, c) => s + (c.lifetimeViews ?? 0), 0),
      // FB "lifetime" is only as old as its daily history — always flag it.
      partial: channels.some((c) => c.platform === "facebook" && (c.lifetimeViews ?? 0) > 0),
    };

    return NextResponse.json({
      updatedAt: rows.length
        ? new Date(Math.max(...rows.map((r) => r.pulledAt.getTime()))).toISOString()
        : null,
      totals,
      channels,
    });
  } catch (err) {
    console.error("[hq/view-counter GET]", err);
    return NextResponse.json({ error: "Failed to load view counter" }, { status: 500 });
  }
}
