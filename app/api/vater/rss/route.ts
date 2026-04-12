/**
 * GET  /api/vater/rss          → list all VaterRssFeed rows
 * POST /api/vater/rss          → probe a feed URL via autopilot, then create
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import {
  detectFeedTypeFromUrl,
  type FeedType,
} from "@/lib/vater/rss-parser";

const VALID_TYPES: ReadonlySet<FeedType> = new Set([
  "youtube",
  "podcast",
  "blog",
  "social",
]);

export async function GET() {
  const feeds = await prisma.vaterRssFeed.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ feeds });
}

export async function POST(req: NextRequest) {
  let body: {
    url?: string;
    feedType?: FeedType;
    autoPipeline?: boolean;
    defaultGoal?: string;
    defaultWords?: number;
    defaultVoiceId?: string;
    defaultStyle?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Probe via autopilot to validate the feed actually parses + grab the title.
  // We let AutopilotError surface so the user sees what went wrong.
  let probe;
  try {
    probe = await autopilot.feedProbe({ url });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Feed probe failed",
          detail: err.body || err.message,
          status: err.status,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Feed probe failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }

  const feedType =
    body.feedType && VALID_TYPES.has(body.feedType)
      ? body.feedType
      : (probe.feedType as FeedType) || detectFeedTypeFromUrl(url);

  try {
    const feed = await prisma.vaterRssFeed.create({
      data: {
        url,
        title: probe.title || null,
        feedType,
        autoPipeline: body.autoPipeline ?? false,
        defaultGoal: body.defaultGoal ?? null,
        defaultWords: body.defaultWords ?? null,
        defaultVoiceId: body.defaultVoiceId ?? null,
        defaultStyle: body.defaultStyle ?? null,
      },
    });
    return NextResponse.json(
      { feed, sample: probe.sample ?? [] },
      { status: 201 },
    );
  } catch (err) {
    // Most likely a unique constraint on `url`
    return NextResponse.json(
      {
        error: "Failed to create feed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 409 },
    );
  }
}
