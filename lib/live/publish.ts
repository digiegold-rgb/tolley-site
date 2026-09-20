import { prisma } from "@/lib/prisma";
import { postYouTube } from "@/lib/social/youtube";
import { postInstagram } from "@/lib/social/instagram";
import { LIVE_PLATFORMS, canAutoPublish, type LivePlatform } from "./core";
import type { PostInput } from "@/lib/social/types";
import type { Prisma } from "@prisma/client";

type Binding = { accountId: string; label: string };
const API = "https://graph.facebook.com/v23.0";
async function graph(url: string, token: string, body?: URLSearchParams) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}` }, body, signal: AbortSignal.timeout(45000) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`Facebook request failed (${r.status}, code ${j.error?.code || "unknown"})`);
  return j;
}
export async function facebookReel(input: PostInput, accountId: string, checkpoint: (id: string) => Promise<void>) {
  const connection = await prisma.platformConnection.findFirst({ where: { subscriberId: "social-suite", platform: `facebook_page:${accountId}`, platformAccountId: accountId, status: "active" } });
  if (!connection) throw new Error("Bound Facebook page is not connected");
  const token = connection.accessToken;
  const identity = await graph(`${API}/${accountId}?fields=id`, token);
  if (identity.id !== accountId) throw new Error("Facebook account mismatch");
  const session = await graph(`${API}/${accountId}/video_reels`, token, new URLSearchParams({ upload_phase: "start" }));
  if (!session.video_id) throw new Error("Facebook returned no video ID");
  await checkpoint(session.video_id);
  const uploadUrl = new URL(session.upload_url);
  if (uploadUrl.protocol !== "https:" || uploadUrl.hostname !== "rupload.facebook.com") throw new Error("Unexpected Facebook upload host");
  const up = await fetch(uploadUrl, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: input.mediaUrl }, signal: AbortSignal.timeout(90000) });
  if (!up.ok || !(await up.json()).success) throw new Error("Facebook Reel upload failed");
  const finish = await graph(`${API}/${accountId}/video_reels`, token, new URLSearchParams({ video_id: session.video_id, upload_phase: "finish", video_state: "PUBLISHED", description: input.caption, title: input.title || "Treasure Hauls" }));
  if (!finish.success) throw new Error("Facebook did not accept the publish request");
  return { externalId: session.video_id as string, url: `https://www.facebook.com/reel/${session.video_id}` };
}

// An attempt is reserved under a database lock BEFORE contacting any platform.
// A timeout/crash is ambiguous and must never automatically create another upload.
export async function reservePublication(clipId: string, platform: LivePlatform) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'treasure-hauls-' + platform}))`;
    const settings = await tx.liveSettings.findUnique({ where: { id: "treasure-hauls" } });
    const binding = (settings?.bindings as Record<string, Binding> | null)?.[platform];
    if (!settings || settings.publishingPaused || !binding?.accountId) return null;
    const clip = await tx.liveClip.findUnique({ where: { id: clipId } });
    if (!clip || clip.status !== "ready" || !canAutoPublish(clip.review)) return null;
    if (await tx.livePublication.findUnique({ where: { clipId_platform: { clipId, platform } } })) return null;
    // Rolling 24 hours is stricter than a calendar-day cap, including midnight/DST.
    const count = await tx.livePublication.count({ where: { platform, createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (count >= 2) return null;
    return tx.livePublication.create({ data: { clipId, platform, accountId: binding.accountId }, include: { clip: true } });
  });
}

export async function drainClips() {
  // A killed worker leaves an in-flight record. Flag it for read-only reconciliation.
  await prisma.livePublication.updateMany({ where: { status: "posting", updatedAt: { lt: new Date(Date.now() - 30 * 60000) } }, data: { status: "uncertain", error: "Worker interrupted; verify platform before retrying" } });
  const clips = await prisma.liveClip.findMany({ where: { status: "ready" }, orderBy: { createdAt: "asc" }, take: 30 });
  for (const clip of clips) for (const platform of LIVE_PLATFORMS) {
    const job = await reservePublication(clip.id, platform);
    if (!job) continue;
    const input: PostInput = { id: clip.id, source: "stream", accountId: job.accountId, onExternalId: async id => { await prisma.livePublication.update({ where: { id: job.id }, data: { externalId: id } }); }, mediaType: "video", mediaUrl: clip.mediaUrl, title: clip.title, caption: `${clip.caption}\n\nFrom a previous Treasure Hauls show; items may be sold. Follow @treasure_hauls on Whatnot. Next show: tolley.io/live (link in profile).`, hashtags: ["#TreasureHauls", "#Reselling", "#Shorts"] };
    try {
      // Recheck the pause/hold immediately before starting the remote request.
      const settings = await prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } });
      const fresh = await prisma.liveClip.findUnique({ where: { id: clip.id } });
      if (settings?.publishingPaused || fresh?.status !== "ready" || (settings?.bindings as Record<string, Binding> | null)?.[platform]?.accountId !== job.accountId) {
        await prisma.livePublication.delete({ where: { id: job.id } }); continue;
      }
      let result: { externalId: string; url: string };
      if (platform === "facebook") result = await facebookReel(input, job.accountId, async id => { await prisma.livePublication.update({ where: { id: job.id }, data: { externalId: id } }); });
      else {
        const r = await (platform === "youtube" ? postYouTube(input) : postInstagram(input));
        if (!r.ok) throw new Error(r.error);
        result = r;
      }
      await prisma.livePublication.update({ where: { id: job.id }, data: { ...result, status: platform === "facebook" ? "processing" : "posted", error: null } });
    } catch {
      // Do not store upstream bodies: tokens or user information may be echoed.
      await prisma.livePublication.update({ where: { id: job.id }, data: { status: "uncertain", error: "Publish not confirmed. Reconcile this attempt before any retry." } });
    }
  }
  await reconcileFacebook();
}

export async function reconcileFacebook() {
  const jobs = await prisma.livePublication.findMany({ where: { platform: "facebook", status: { in: ["processing", "uncertain"] }, externalId: { not: null } } });
  for (const job of jobs) {
    const connection = await prisma.platformConnection.findFirst({ where: { subscriberId: "social-suite", platform: `facebook_page:${job.accountId}`, platformAccountId: job.accountId, status: "active" } });
    if (!connection) continue;
    try {
      const j = await graph(`${API}/${job.externalId}?fields=status`, connection.accessToken);
      if (j.status?.publishing_phase?.status === "complete") await prisma.livePublication.update({ where: { id: job.id }, data: { status: "posted", url: `https://www.facebook.com/reel/${job.externalId}`, error: null } });
      else if (j.status?.video_status === "error") await prisma.livePublication.update({ where: { id: job.id }, data: { status: "failed", error: "Facebook reports a processing failure. Review before retrying." } });
    } catch { /* retain the existing ID and retry read-only status next run */ }
  }
}
export async function registerClip(data: { id: string; showId?: string; recording: string; startS: number; endS: number; title: string; caption: string; mediaUrl: string; review: Prisma.InputJsonValue }) {
  if (!/^[a-f0-9]{32,64}$/.test(data.id) || !Number.isFinite(data.startS) || !Number.isFinite(data.endS) || data.startS < 0 || data.endS - data.startS < 20 || data.endS - data.startS > 45) throw new Error("Invalid clip identity or duration");
  const url = new URL(data.mediaUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) throw new Error("Clip must use the public media store");
  return prisma.liveClip.upsert({ where: { id: data.id }, create: { ...data, title: data.title.slice(0,90), caption: data.caption.slice(0,1000), status: canAutoPublish(data.review) ? "ready" : "held" }, update: {} });
}
