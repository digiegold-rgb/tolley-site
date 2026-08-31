/**
 * lib/vater/social-vendor/zernio.ts
 *
 * Thin server-side client for Zernio (formerly Late / getlate.dev) — the
 * social-publishing aggregator behind /animate's "Connect TikTok / IG / FB /
 * Pinterest / X / LinkedIn" (2026-08-17). YouTube stays on our own OAuth.
 *
 * Model (docs.zernio.com/multi-tenant):
 *   team (our API key) → one PROFILE per /animate user → N connected ACCOUNTS
 *   → POSTS target accountIds. Profile ↔ user and account ↔ user live in OUR
 *   DB (VaterSocialProfile / SocialAccount.externalAccountId) — Zernio
 *   validates accountIds against the whole team, so ownership is our job.
 *
 * Env: ZERNIO_API_KEY (sk_…), ANIMATE_SOCIAL_VENDOR=zernio to enable,
 *      ZERNIO_WEBHOOK_SECRET (optional, HMAC for /api/webhooks/zernio).
 *
 * Nothing here posts on its own — every createPost() is behind an explicit
 * user click in the publish panel (feedback_no_autonomous_sends.md).
 */
import { prisma } from "@/lib/prisma";
import { tenantEmailFor } from "@/lib/vater/tenant-identity";
import type { SupportedPlatform } from "@/lib/vater-social";

const BASE = "https://zernio.com/api/v1";

export const VENDOR = "zernio" as const;

/** Platforms we route through the vendor. YouTube moved from native OAuth to
 *  the vendor on 2026-08-19 (Jared: every direct connection = one Zernio
 *  profile per customer at $6/mo per connected account). Legacy provider
 *  "native" YouTube rows keep working through ./publish. */
export const VENDOR_PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
  "twitter",
  "linkedin",
] as const satisfies readonly SupportedPlatform[];
export type VendorPlatform = (typeof VENDOR_PLATFORMS)[number];

export function isVendorPlatform(p: string): p is VendorPlatform {
  return (VENDOR_PLATFORMS as readonly string[]).includes(p);
}

export function isZernioEnabled(): boolean {
  return (
    (process.env.ANIMATE_SOCIAL_VENDOR ?? "").toLowerCase() === "zernio" &&
    !!process.env.ZERNIO_API_KEY
  );
}

export class ZernioError extends Error {
  status: number;
  body: string;
  code?: string;
  constructor(status: number, body: string, code?: string) {
    super(`Zernio ${status}: ${body.slice(0, 300)}`);
    this.name = "ZernioError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

async function call<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new ZernioError(500, "ZERNIO_API_KEY missing");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(extraHeaders ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = (JSON.parse(text) as { code?: string }).code;
    } catch {
      /* not json */
    }
    throw new ZernioError(res.status, text, code);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export interface ZernioProfile {
  _id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

/**
 * Resolve (or lazily create) the vendor profile for a user. Profile names
 * are unique per team — we key on our userId so retries are idempotent.
 */
/** Human-findable vendor profile name: the user's email local-part plus a
 *  short id suffix (two customers can share a local-part). Jared looks
 *  profiles up on the Zernio dashboard by asking the customer their email —
 *  `animate_<cuid>` made that impossible (2026-08-19). */
async function profileNameFor(
  userId: string,
  label?: string | null,
): Promise<string> {
  let email = (label ?? "").includes("@") ? (label as string) : "";
  if (!email) {
    // Root email: a workspace tab has none of its own, and Jared looks
    // profiles up on the Zernio dashboard by the customer's login email.
    email = (await tenantEmailFor(userId)) ?? "";
  }
  const local = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
  return local ? `${local}__${userId.slice(-6)}` : `animate_${userId}`;
}

/** Rename an existing vendor profile (dashboard display only). */
export async function renameProfile(
  externalProfileId: string,
  name: string,
): Promise<void> {
  await call("PUT", `/profiles/${encodeURIComponent(externalProfileId)}`, {
    name,
  });
}

export async function ensureProfileForUser(
  userId: string,
  label?: string | null,
): Promise<{ externalProfileId: string }> {
  const existing = await prisma.vaterSocialProfile.findUnique({
    where: { userId },
    select: { externalProfileId: true },
  });
  if (existing) return existing;

  const name = await profileNameFor(userId, label);
  let profileId: string | undefined;
  try {
    const created = await call<{ profile: ZernioProfile }>(
      "POST",
      "/profiles",
      { name, description: (label ?? "").slice(0, 120) || "tolley.io/animate user" },
      { "Idempotency-Key": `profile:${userId}` },
    );
    profileId = created.profile._id;
  } catch (err) {
    // 409 = already exists (a prior attempt created it but our row write
    // failed). Look it up by exact name.
    if (err instanceof ZernioError && err.status === 409) {
      const list = await call<{ profiles: ZernioProfile[] }>(
        "GET",
        `/profiles?name=${encodeURIComponent(name)}`,
      );
      profileId = list.profiles?.[0]?._id;
    }
    if (!profileId) throw err;
  }
  await prisma.vaterSocialProfile.upsert({
    where: { userId },
    create: { userId, vendor: VENDOR, externalProfileId: profileId },
    update: { externalProfileId: profileId },
  });
  return { externalProfileId: profileId };
}

// ─── Connect (hosted OAuth) ─────────────────────────────────────────────────

/**
 * Returns the vendor-hosted OAuth URL for a platform. Zernio runs the
 * platform's consent + any selection UI (FB page, IG account, Pinterest
 * board, LinkedIn org) and then 302s the browser to `redirectUrl`.
 * `force` re-runs OAuth even if an account exists (reconnect).
 */
export async function getConnectUrl(
  profileId: string,
  platform: VendorPlatform,
  redirectUrl: string,
  force = false,
): Promise<{ authUrl?: string; alreadyConnected?: boolean }> {
  const qs = new URLSearchParams({ profileId, redirect_url: redirectUrl });
  if (force) qs.set("force", "true");
  return call<{ authUrl?: string; alreadyConnected?: boolean }>(
    "GET",
    `/connect/${platform}?${qs.toString()}`,
  );
}

// ─── Accounts ───────────────────────────────────────────────────────────────

export interface ZernioAccount {
  _id: string;
  platform: string;
  profileId: string;
  username?: string;
  displayName?: string;
  profilePicture?: string | null;
  profileUrl?: string;
  isActive: boolean;
  needsReconnection?: boolean;
  enabled?: boolean;
}

export async function listAccounts(profileId: string): Promise<ZernioAccount[]> {
  const data = await call<{ accounts: ZernioAccount[] }>(
    "GET",
    `/accounts?profileId=${encodeURIComponent(profileId)}`,
  );
  return (data.accounts ?? []).filter((a) => a.enabled !== false);
}

export async function deleteAccount(accountId: string): Promise<void> {
  await call("DELETE", `/accounts/${encodeURIComponent(accountId)}`);
}

/**
 * Mirror the vendor's account list for one user into SocialAccount rows
 * (provider="zernio"). Native rows (YouTube) are untouched. Vendor rows for
 * platforms no longer connected are removed. Returns the platforms present.
 */
export async function syncAccountsForUser(userId: string): Promise<string[]> {
  const profile = await prisma.vaterSocialProfile.findUnique({
    where: { userId },
    select: { externalProfileId: true },
  });
  if (!profile) return [];
  const accounts = await listAccounts(profile.externalProfileId);
  const seen = new Set<string>();
  for (const a of accounts) {
    if (!isVendorPlatform(a.platform)) continue; // ads/other platform kinds
    seen.add(a.platform);
    const status = a.needsReconnection
      ? "expired"
      : a.isActive === false
        ? "error"
        : "active";
    await prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform: a.platform } },
      create: {
        userId,
        platform: a.platform,
        provider: VENDOR,
        externalAccountId: a._id,
        displayName: a.displayName || a.username || null,
        username: a.username || null,
        avatarUrl: a.profilePicture || null,
        profileUrl: a.profileUrl || null,
        credentials: {},
        status,
        lastError: a.needsReconnection ? "Reconnect required" : null,
      },
      update: {
        provider: VENDOR,
        externalAccountId: a._id,
        displayName: a.displayName || a.username || null,
        username: a.username || null,
        avatarUrl: a.profilePicture || null,
        profileUrl: a.profileUrl || null,
        status,
        lastError: a.needsReconnection ? "Reconnect required" : null,
      },
    });
  }
  // Drop vendor rows the vendor no longer reports (user disconnected on the
  // hosted page, token revoked + purged, etc.). Never touch native rows.
  await prisma.socialAccount.deleteMany({
    where: {
      userId,
      provider: VENDOR,
      platform: { notIn: [...seen] },
    },
  });
  return [...seen];
}

// ─── Platform helpers ───────────────────────────────────────────────────────

export interface PinterestBoard {
  id: string;
  name: string;
  privacy?: string;
}
export async function listPinterestBoards(accountId: string): Promise<PinterestBoard[]> {
  const data = await call<{ boards?: PinterestBoard[] }>(
    "GET",
    `/accounts/${encodeURIComponent(accountId)}/pinterest-boards`,
  );
  return data.boards ?? [];
}

export interface TikTokCreatorInfo {
  privacyLevels?: string[];
  privacy_level_options?: string[];
  postingLimits?: { maxVideoPostDaily?: number; remaining?: number };
  commercialContentTypes?: string[];
  creatorNickname?: string;
  creatorUsername?: string;
}
export async function getTikTokCreatorInfo(accountId: string): Promise<TikTokCreatorInfo> {
  return call<TikTokCreatorInfo>(
    "GET",
    `/accounts/${encodeURIComponent(accountId)}/tiktok-creator-info`,
  );
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export interface ZernioPlatformTarget {
  platform: VendorPlatform | "youtube";
  accountId: string;
  platformSpecificData?: Record<string, unknown>;
  customContent?: string;
}

export interface ZernioPost {
  _id: string;
  status: string; // draft | scheduled | publishing | published | partial | failed | cancelled
  content?: string;
  scheduledFor?: string;
  publishedAt?: string;
  platforms: Array<{
    platform: string;
    accountId?: string;
    status?: string;
    platformPostId?: string;
    platformPostUrl?: string;
    publishedUrl?: string;
    error?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface CreatePostInput {
  content: string;
  videoUrl: string;
  title?: string;
  platforms: ZernioPlatformTarget[];
  /** ISO local wall-clock (no zone) + IANA tz, or omit for publishNow. */
  scheduledFor?: string;
  timezone?: string;
  tiktokSettings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Idempotency — a stable id per (project, click). */
  requestId: string;
}

export async function createVideoPost(input: CreatePostInput): Promise<ZernioPost> {
  const body: Record<string, unknown> = {
    content: input.content,
    ...(input.title ? { title: input.title } : {}),
    mediaItems: [{ type: "video", url: input.videoUrl }],
    platforms: input.platforms,
    ...(input.scheduledFor
      ? { scheduledFor: input.scheduledFor, timezone: input.timezone ?? "UTC" }
      : { publishNow: true }),
    ...(input.tiktokSettings ? { tiktokSettings: input.tiktokSettings } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
  const data = await call<{ post: ZernioPost; existingPost?: ZernioPost }>(
    "POST",
    "/posts",
    body,
    { "x-request-id": input.requestId },
  );
  return data.post ?? (data.existingPost as ZernioPost);
}

export async function getPost(postId: string): Promise<ZernioPost> {
  const data = await call<{ post: ZernioPost }>(
    "GET",
    `/posts/${encodeURIComponent(postId)}`,
  );
  return data.post;
}

/**
 * Delete a draft/scheduled vendor post. Published posts cannot be deleted
 * (vendor 405); we still try DELETE then POST /delete so a 404/405 is
 * recoverable. Callers that only need "it's gone" should treat 404 as ok.
 */
export async function deletePost(postId: string): Promise<void> {
  try {
    await call("DELETE", `/posts/${encodeURIComponent(postId)}`);
  } catch (err) {
    if (err instanceof ZernioError && (err.status === 404 || err.status === 405)) {
      try {
        await call("POST", `/posts/${encodeURIComponent(postId)}/delete`);
      } catch (inner) {
        if (inner instanceof ZernioError && inner.status === 404) return;
        throw inner;
      }
      return;
    }
    throw err;
  }
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface ZernioAnalyticsRow {
  postId?: string;
  _id?: string;
  id?: string;
  platform?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  reach?: number;
  [key: string]: unknown;
}

export interface ZernioAnalyticsPage {
  analytics?: ZernioAnalyticsRow[];
  posts?: ZernioAnalyticsRow[];
  data?: ZernioAnalyticsRow[];
  pagination?: { page?: number; limit?: number; hasMore?: boolean; pages?: number };
  hasMore?: boolean;
  page?: number;
}

/** GET /v1/analytics — paginated. All metric fields optional. */
export async function getPostAnalytics(opts?: {
  postId?: string;
  accountId?: string;
  profileId?: string;
  platform?: string;
  fromDate?: string;
  toDate?: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<ZernioAnalyticsRow[]> {
  const out: ZernioAnalyticsRow[] = [];
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 50));
  const maxPages = Math.min(40, Math.max(1, opts?.maxPages ?? 20));
  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("page", String(page));
    if (opts?.postId) qs.set("postId", opts.postId);
    if (opts?.accountId) qs.set("accountId", opts.accountId);
    if (opts?.profileId) qs.set("profileId", opts.profileId);
    if (opts?.platform) qs.set("platform", opts.platform);
    if (opts?.fromDate) qs.set("fromDate", opts.fromDate);
    if (opts?.toDate) qs.set("toDate", opts.toDate);
    const data = await call<ZernioAnalyticsPage>("GET", `/analytics?${qs.toString()}`);
    const rows = data.analytics ?? data.posts ?? data.data ?? [];
    if (Array.isArray(rows)) out.push(...rows);
    const hasMore =
      data.hasMore === true ||
      data.pagination?.hasMore === true ||
      (typeof data.pagination?.pages === "number" && page < data.pagination.pages);
    if (!hasMore || rows.length < pageSize) break;
  }
  return out;
}

export interface ZernioFollowerStats {
  accountId?: string;
  followers?: number;
  followerCount?: number;
  [key: string]: unknown;
}

/** GET /v1/analytics/follower-stats, fallback GET /v1/accounts/follower-stats. */
export async function getFollowerStats(
  accountId: string,
): Promise<ZernioFollowerStats | null> {
  const qs = `accountId=${encodeURIComponent(accountId)}`;
  try {
    return await call<ZernioFollowerStats>("GET", `/analytics/follower-stats?${qs}`);
  } catch (err) {
    if (err instanceof ZernioError && (err.status === 404 || err.status === 501)) {
      try {
        return await call<ZernioFollowerStats>("GET", `/accounts/follower-stats?${qs}`);
      } catch (inner) {
        if (inner instanceof ZernioError && (inner.status === 404 || inner.status === 501)) {
          return null;
        }
        throw inner;
      }
    }
    throw err;
  }
}

async function insightOrNull(path: string): Promise<unknown | null> {
  try {
    return await call<unknown>("GET", path);
  } catch (err) {
    if (err instanceof ZernioError && (err.status === 404 || err.status === 501)) {
      return null;
    }
    throw err;
  }
}

/**
 * Platform-specific channel insights. 404/501 → null, never throw.
 * youtube: channel-insights + daily-views
 * tiktok: account-insights
 * instagram: follower-history + account-insights
 * facebook: page-insights
 */
export async function getChannelInsights(
  platform: string,
  accountId: string,
): Promise<unknown | null> {
  const id = encodeURIComponent(accountId);
  const acc = `accountId=${id}`;
  try {
    switch (platform) {
      case "youtube": {
        const channel = await insightOrNull(`/analytics/youtube/channel-insights?${acc}`);
        const daily = await insightOrNull(`/analytics/youtube/daily-views?${acc}`);
        if (channel == null && daily == null) return null;
        return { channel, daily };
      }
      case "tiktok":
        return await insightOrNull(`/analytics/tiktok/account-insights?${acc}`);
      case "instagram": {
        const history = await insightOrNull(`/analytics/instagram/follower-history?${acc}`);
        const account = await insightOrNull(`/analytics/instagram/account-insights?${acc}`);
        if (history == null && account == null) return null;
        return { history, account };
      }
      case "facebook":
        return await insightOrNull(`/analytics/facebook/page-insights?${acc}`);
      default:
        return null;
    }
  } catch (err) {
    if (err instanceof ZernioError && (err.status === 404 || err.status === 501)) {
      return null;
    }
    throw err;
  }
}

/** Normalize a vendor post into our VaterSocialPost row shape. */
export function summarizePost(p: ZernioPost): {
  status: string;
  platforms: Array<{
    platform: string;
    accountId?: string;
    status?: string;
    publishedUrl?: string;
    error?: string;
  }>;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  lastError: string | null;
} {
  const platforms = (p.platforms ?? []).map((t) => ({
    platform: t.platform,
    accountId: t.accountId,
    status: t.status,
    publishedUrl: t.publishedUrl ?? t.platformPostUrl,
    error: t.error,
  }));
  const firstErr = platforms.find((t) => t.error)?.error ?? null;
  return {
    status: p.status,
    platforms,
    publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
    scheduledFor: p.scheduledFor ? new Date(p.scheduledFor) : null,
    lastError: firstErr,
  };
}
