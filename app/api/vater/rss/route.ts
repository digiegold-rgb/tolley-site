/**
 * GET  /api/vater/rss          → list all VaterRssFeed rows
 * POST /api/vater/rss          → probe a feed URL via autopilot, then create
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { assertPublicUrl, UnsafeUrlError } from "@/lib/net/assert-public-url";
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
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const feeds = await prisma.vaterRssFeed.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ feeds });
}

export async function POST(req: NextRequest) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

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
  // SSRF guard: http(s) + public IP only, before any server-side fetch.
  try {
    await assertPublicUrl(url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
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
