import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { buildHqStatsPayload } from "@/lib/hq-stats";

export const runtime = "nodejs";
export const maxDuration = 120;

const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * POST /api/hq/stats/analyze — the one-click "what's working / what's not"
 * recap. Compacts the same rollup GET /api/hq/stats serves, asks Gemini for a
 * plain-English read, stores it as an HqStatsAnalysis row. GET returns the
 * latest stored recap.
 */
export async function POST() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 503 });
  }

  try {
    const payload = await buildHqStatsPayload();
    if (payload.videos.length === 0) {
      return NextResponse.json(
        { error: "No YouTube snapshots yet — run /api/cron/youtube-stats first" },
        { status: 409 },
      );
    }

    // Compact input: top 40 videos by views + rollups, no nulls spelled out.
    const compact = {
      pipelines: payload.pipelines,
      firstParty: payload.firstParty,
      lastPullAt: payload.lastPullAt,
      videos: [...payload.videos]
        .sort((a, b) => b.views - a.views)
        .slice(0, 40)
        .map((v) => ({
          title: v.title.slice(0, 80),
          pipeline: v.pipeline,
          published: v.publishedAt.slice(0, 10),
          views: v.views,
          views7d: v.views7d,
          likes: v.likes,
          avgViewPct: v.avgViewPct != null ? Math.round(v.avgViewPct) : null,
          avgViewDurationSec: v.avgViewDurationSec != null ? Math.round(v.avgViewDurationSec) : null,
        })),
    };

    const prompt = [
      "You are the growth analyst for a solo entrepreneur's YouTube channel (@yourkchome) that carries several automated pipelines:",
      '- "shorts": AI-avatar product Shorts driving Amazon affiliate clicks',
      '- "housing": daily KC housing-market stat Shorts',
      '- "listings": daily long-form new-listings tour videos',
      '- "estate": estate-sale recap/teaser videos',
      '- "other": unattributed uploads',
      "",
      "Here is the current data (per-video latest lifetime stats, views7d = views gained in the last 7 days, plus site-wide first-party numbers):",
      JSON.stringify(compact),
      "",
      "Write a plain-English recap in markdown with exactly these sections:",
      "## What's working",
      "## What's not",
      "## 3 concrete recommendations",
      "Cite real numbers from the data. Compare pipelines honestly (views, retention avgViewPct, 7-day momentum). If a pipeline is clearly underperforming per video produced, say so. Keep it under 350 words, no fluff, no hedging.",
    ].join("\n");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1500,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const markdown: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!markdown.trim()) {
      throw new Error(`Empty Gemini response: ${JSON.stringify(data).slice(0, 300)}`);
    }

    const inputHash = createHash("sha256").update(JSON.stringify(compact)).digest("hex").slice(0, 16);
    const analysis = await prisma.hqStatsAnalysis.create({
      data: { markdown, inputHash },
    });

    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    console.error("[hq/stats/analyze POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "analyze failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const analysis = await prisma.hqStatsAnalysis.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ analysis });
}
