/**
 * lib/vater/socials/publish-core.ts
 *
 * Shared "create one Zernio video post + upsert VaterSocialPost" used by
 * POST /api/vater/youtube/[id]/publish-social and the drip batch route.
 * Nothing here posts on its own — every call is behind an explicit user
 * confirm (feedback_no_autonomous_sends.md).
 */
import { prisma } from "@/lib/prisma";
import { isMissingSchemaError } from "@/lib/vater/schema-probe";
import {
  createVideoPost,
  isVendorPlatform,
  summarizePost,
  VENDOR,
  type VendorPlatform,
  type ZernioPlatformTarget,
} from "@/lib/vater/social-vendor/zernio";

export const TIKTOK_PRIVACY = new Set([
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
]);

export interface PublishSocialInput {
  userId: string;
  project: {
    id: string;
    status: string;
    finalVideoUrl: string | null;
    description: string | null;
    publishTitle?: string | null;
    sourceTitle?: string | null;
  };
  platforms: VendorPlatform[];
  caption?: string;
  /** Vendor wall-clock "YYYY-MM-DDTHH:mm:ss" (omit = publish now). */
  scheduledFor?: string;
  timezone?: string;
  tiktok?: {
    privacyLevel?: string;
    allowComment?: boolean;
    allowDuet?: boolean;
    allowStitch?: boolean;
  };
  pinterest?: { boardId?: string; link?: string };
  requestId: string;
  batchId?: string;
}

export type PublishSocialResult =
  | { ok: true; post: Awaited<ReturnType<typeof prisma.vaterSocialPost.upsert>> }
  | { ok: false; status: number; error: string };

export function parseVendorPlatforms(raw: unknown): VendorPlatform[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is VendorPlatform => typeof p === "string" && isVendorPlatform(p),
  );
}

export async function publishSocialPost(
  input: PublishSocialInput,
): Promise<PublishSocialResult> {
  const { userId, project } = input;
  const wanted = input.platforms;
  if (wanted.length === 0) {
    return { ok: false, status: 400, error: "Pick at least one connected platform" };
  }
  if (project.status !== "ready" || !project.finalVideoUrl) {
    return {
      ok: false,
      status: 409,
      error: `Project is not finished yet (status '${project.status}')`,
    };
  }
  if (!/^https:\/\//.test(project.finalVideoUrl)) {
    return {
      ok: false,
      status: 409,
      error:
        "This video's final file is not on the public CDN yet. Re-export from the editor (or re-render) and try again.",
    };
  }

  const caption =
    typeof input.caption === "string" && input.caption.trim()
      ? input.caption.trim()
      : (project.description ?? "").trim();
  const title = (project.publishTitle ?? project.sourceTitle ?? "").trim();
  if (!caption && !title) {
    return {
      ok: false,
      status: 400,
      error: "Write a caption (or set a title/description) before posting",
    };
  }

  const rows = await prisma.socialAccount.findMany({
    where: {
      userId,
      provider: VENDOR,
      platform: { in: wanted },
    },
    select: { platform: true, externalAccountId: true, status: true },
  });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));
  const missing = wanted.filter((p) => !byPlatform.get(p)?.externalAccountId);
  if (missing.length) {
    return {
      ok: false,
      status: 409,
      error: `Not connected: ${missing.join(", ")}. Connect them on the Publishing screen first.`,
    };
  }
  const stale = wanted.filter((p) => byPlatform.get(p)?.status !== "active");
  if (stale.length) {
    return {
      ok: false,
      status: 409,
      error: `Reconnect required: ${stale.join(", ")}`,
    };
  }

  const targets: ZernioPlatformTarget[] = [];
  for (const p of wanted) {
    const accountId = byPlatform.get(p)!.externalAccountId!;
    const psd: Record<string, unknown> = {};
    if (p === "pinterest") {
      const boardId = input.pinterest?.boardId;
      if (typeof boardId !== "string" || !boardId) {
        return {
          ok: false,
          status: 400,
          error: "Pinterest needs a board — pick one in the publish panel",
        };
      }
      psd.boardId = boardId;
      if (title) psd.title = title.slice(0, 100);
      if (typeof input.pinterest?.link === "string" && /^https:\/\//.test(input.pinterest.link)) {
        psd.link = input.pinterest.link;
      }
    }
    if (p === "twitter") {
      const tweet = (caption || title).slice(0, 270);
      targets.push({ platform: p, accountId, customContent: tweet });
      continue;
    }
    if (p === "linkedin") psd.disableLinkPreview = false;
    if (p === "youtube" && title) psd.title = title.slice(0, 100);
    targets.push({
      platform: p,
      accountId,
      ...(Object.keys(psd).length ? { platformSpecificData: psd } : {}),
    });
  }

  let tiktokSettings: Record<string, unknown> | undefined;
  if (wanted.includes("tiktok")) {
    const pl = input.tiktok?.privacyLevel;
    tiktokSettings = {
      privacy_level:
        typeof pl === "string" && TIKTOK_PRIVACY.has(pl) ? pl : "PUBLIC_TO_EVERYONE",
      allow_comment: input.tiktok?.allowComment !== false,
      allow_duet: input.tiktok?.allowDuet !== false,
      allow_stitch: input.tiktok?.allowStitch !== false,
      content_preview_confirmed: true,
      express_consent_given: true,
    };
  }

  const post = await createVideoPost({
    content: caption || title,
    title: title || undefined,
    videoUrl: project.finalVideoUrl,
    platforms: targets,
    scheduledFor: input.scheduledFor,
    timezone: input.timezone,
    tiktokSettings,
    metadata: {
      projectId: project.id,
      userId,
      source: "animate",
      ...(input.batchId ? { batchId: input.batchId } : {}),
    },
    requestId: input.requestId,
  });
  const s = summarizePost(post);
  const baseCreate = {
    userId,
    projectId: project.id,
    vendor: VENDOR,
    externalPostId: post._id,
    platforms: s.platforms,
    caption: caption || title,
    status: s.status,
    scheduledFor: s.scheduledFor,
    publishedAt: s.publishedAt,
    lastError: s.lastError,
  };
  const baseUpdate = {
    platforms: s.platforms,
    status: s.status,
    scheduledFor: s.scheduledFor,
    publishedAt: s.publishedAt,
    lastError: s.lastError,
  };
  let row;
  try {
    row = await prisma.vaterSocialPost.upsert({
      where: { externalPostId: post._id },
      create: {
        ...baseCreate,
        ...(input.batchId ? { batchId: input.batchId } : {}),
      },
      update: {
        ...baseUpdate,
        ...(input.batchId ? { batchId: input.batchId } : {}),
      },
    });
  } catch (err) {
    // batchId column is part of the hand-applied socials_stats migration.
    if (!isMissingSchemaError(err) || !input.batchId) throw err;
    row = await prisma.vaterSocialPost.upsert({
      where: { externalPostId: post._id },
      create: baseCreate,
      update: baseUpdate,
    });
  }
  await prisma.socialAccount.updateMany({
    where: { userId, provider: VENDOR, platform: { in: wanted } },
    data: { lastUsedAt: new Date() },
  });
  return { ok: true, post: row };
}
