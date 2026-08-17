/**
 * POST /api/vater/youtube/[id]/publish-social
 *
 * Publish a finished project to the user's OWN connected TikTok / Instagram /
 * Facebook / Pinterest / X / LinkedIn accounts through the aggregator
 * (Zernio). YouTube stays on ./publish (native upload).
 *
 * Only ever runs from an explicit click in the publish panel — nothing
 * schedules it, no cron touches it (feedback_no_autonomous_sends.md).
 *
 * Body: {
 *   platforms: string[];            // subset of the user's connected vendor platforms
 *   caption?: string;               // default: project.description
 *   scheduleAt?: string;            // ISO (UTC) — omit = publish now
 *   timezone?: string;              // IANA, for the vendor's wall-clock schedule
 *   tiktok?: { privacyLevel?: string; allowComment?: boolean; allowDuet?: boolean; allowStitch?: boolean };
 *   pinterest?: { boardId?: string; link?: string };
 * }
 * Response: { post: VaterSocialPost }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import {
  createVideoPost,
  isVendorPlatform,
  isZernioEnabled,
  summarizePost,
  VENDOR,
  ZernioError,
  type VendorPlatform,
  type ZernioPlatformTarget,
} from "@/lib/vater/social-vendor/zernio";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

interface Body {
  platforms?: unknown;
  caption?: unknown;
  scheduleAt?: unknown;
  timezone?: unknown;
  tiktok?: {
    privacyLevel?: unknown;
    allowComment?: unknown;
    allowDuet?: unknown;
    allowStitch?: unknown;
  };
  pinterest?: { boardId?: unknown; link?: unknown };
}

const TIKTOK_PRIVACY = new Set([
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
]);

/** Local wall-clock "YYYY-MM-DDTHH:mm:ss" in `tz` for an instant. */
function wallClock(iso: string, tz: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour");
  return `${g("year")}-${g("month")}-${g("day")}T${hh}:${g("minute")}:${g("second")}`;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isZernioEnabled()) {
    return NextResponse.json(
      { error: "Direct social publishing is not enabled on this deployment." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const wanted = Array.isArray(body.platforms)
    ? (body.platforms.filter(
        (p): p is VendorPlatform => typeof p === "string" && isVendorPlatform(p),
      ) as VendorPlatform[])
    : [];
  if (wanted.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one connected platform" },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.status !== "ready" || !project.finalVideoUrl) {
    return NextResponse.json(
      { error: `Project is not finished yet (status '${project.status}')` },
      { status: 409 },
    );
  }
  // The vendor fetches the MP4 itself, so it must be a public https URL.
  // Blob-hosted finals are; legacy DGX-tunnel paths are not.
  if (!/^https:\/\//.test(project.finalVideoUrl)) {
    return NextResponse.json(
      {
        error:
          "This video's final file is not on the public CDN yet. Re-export from the editor (or re-render) and try again.",
      },
      { status: 409 },
    );
  }

  const caption =
    typeof body.caption === "string" && body.caption.trim()
      ? body.caption.trim()
      : (project.description ?? "").trim();
  const title = (project.publishTitle ?? project.sourceTitle ?? "").trim();
  if (!caption && !title) {
    return NextResponse.json(
      { error: "Write a caption (or set a title/description) before posting" },
      { status: 400 },
    );
  }

  // Resolve vendor accountIds for the wanted platforms — must be THIS user's.
  const rows = await prisma.socialAccount.findMany({
    where: {
      userId: session.user.id,
      provider: VENDOR,
      platform: { in: wanted },
    },
    select: { platform: true, externalAccountId: true, status: true },
  });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));
  const missing = wanted.filter((p) => !byPlatform.get(p)?.externalAccountId);
  if (missing.length) {
    return NextResponse.json(
      { error: `Not connected: ${missing.join(", ")}. Connect them on the Publishing screen first.` },
      { status: 409 },
    );
  }
  const stale = wanted.filter((p) => byPlatform.get(p)?.status !== "active");
  if (stale.length) {
    return NextResponse.json(
      { error: `Reconnect required: ${stale.join(", ")}` },
      { status: 409 },
    );
  }

  // Schedule handling — reject the past loudly.
  let scheduledFor: string | undefined;
  let timezone: string | undefined;
  if (typeof body.scheduleAt === "string" && body.scheduleAt) {
    const when = new Date(body.scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() + 60_000) {
      return NextResponse.json(
        { error: "scheduleAt must be an ISO timestamp at least a minute in the future" },
        { status: 400 },
      );
    }
    timezone = typeof body.timezone === "string" && body.timezone ? body.timezone : "UTC";
    try {
      scheduledFor = wallClock(when.toISOString(), timezone);
    } catch {
      timezone = "UTC";
      scheduledFor = when.toISOString().slice(0, 19);
    }
  }

  // Per-platform targets + settings.
  const targets: ZernioPlatformTarget[] = [];
  for (const p of wanted) {
    const accountId = byPlatform.get(p)!.externalAccountId!;
    const psd: Record<string, unknown> = {};
    if (p === "pinterest") {
      const boardId = body.pinterest?.boardId;
      if (typeof boardId !== "string" || !boardId) {
        return NextResponse.json(
          { error: "Pinterest needs a board — pick one in the publish panel" },
          { status: 400 },
        );
      }
      psd.boardId = boardId;
      if (title) psd.title = title.slice(0, 100);
      if (typeof body.pinterest?.link === "string" && /^https:\/\//.test(body.pinterest.link)) {
        psd.link = body.pinterest.link;
      }
    }
    if (p === "twitter") {
      // X hard-caps at 280 for non-Premium; give it title + a trimmed caption.
      const tweet = (caption || title).slice(0, 270);
      targets.push({ platform: p, accountId, customContent: tweet });
      continue;
    }
    if (p === "linkedin") psd.disableLinkPreview = false;
    targets.push({
      platform: p,
      accountId,
      ...(Object.keys(psd).length ? { platformSpecificData: psd } : {}),
    });
  }

  let tiktokSettings: Record<string, unknown> | undefined;
  if (wanted.includes("tiktok")) {
    const pl = body.tiktok?.privacyLevel;
    tiktokSettings = {
      privacy_level:
        typeof pl === "string" && TIKTOK_PRIVACY.has(pl) ? pl : "PUBLIC_TO_EVERYONE",
      allow_comment: body.tiktok?.allowComment !== false,
      allow_duet: body.tiktok?.allowDuet !== false,
      allow_stitch: body.tiktok?.allowStitch !== false,
      // The publish panel shows the exact video + caption before this call
      // fires, which is what TikTok's UX rules require us to attest.
      content_preview_confirmed: true,
      express_consent_given: true,
    };
  }

  const requestId = randomUUID();
  try {
    const post = await createVideoPost({
      content: caption || title,
      title: title || undefined,
      videoUrl: project.finalVideoUrl,
      platforms: targets,
      scheduledFor,
      timezone,
      tiktokSettings,
      metadata: { projectId: project.id, userId: session.user.id, source: "animate" },
      requestId,
    });
    const s = summarizePost(post);
    const row = await prisma.vaterSocialPost.upsert({
      where: { externalPostId: post._id },
      create: {
        userId: session.user.id,
        projectId: project.id,
        vendor: VENDOR,
        externalPostId: post._id,
        platforms: s.platforms,
        caption: caption || title,
        status: s.status,
        scheduledFor: s.scheduledFor,
        publishedAt: s.publishedAt,
        lastError: s.lastError,
      },
      update: {
        platforms: s.platforms,
        status: s.status,
        scheduledFor: s.scheduledFor,
        publishedAt: s.publishedAt,
        lastError: s.lastError,
      },
    });
    await prisma.socialAccount.updateMany({
      where: { userId: session.user.id, provider: VENDOR, platform: { in: wanted } },
      data: { lastUsedAt: new Date() },
    });
    return NextResponse.json({ post: row });
  } catch (err) {
    if (err instanceof ZernioError) {
      let msg = err.body;
      try {
        const j = JSON.parse(err.body) as { error?: string; details?: unknown };
        msg = j.error ?? err.body;
      } catch {
        /* raw */
      }
      const status = err.status === 409 ? 409 : err.status === 400 ? 400 : 502;
      return NextResponse.json({ error: `Publish failed: ${msg}`.slice(0, 500) }, { status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 },
    );
  }
}
