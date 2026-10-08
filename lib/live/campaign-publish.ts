import { isAnnouncement } from "../growth/core";
import { prisma } from "@/lib/prisma";
import { campaignDecision, assertAutomatedCopy, centralDate, centralInstant } from "./campaign";
import { postInstagram } from "@/lib/social/instagram";
import type { LiveCampaignPost } from "@prisma/client";
import { AFFILIATE_DISCLOSURE } from "./impact-core";

export type Binding = { accountId: string; label: string };
export function campaignBinding(bindings: Record<string, Binding>, post: { platform: string; accountId: string; kind: string }) {
  const dedicated = bindings[post.platform];
  if (isAnnouncement(post.kind)) return dedicated?.accountId === post.accountId ? dedicated : bindings[`crossover:${post.platform}:${post.accountId}`];
  return bindings[post.kind === "crossover" ? `crossover:${post.platform}:${post.accountId}` : post.platform];
}
export async function verifyCampaignAccount(platform: string, accountId: string) {
  if (!["facebook", "instagram"].includes(platform)) throw new Error("Use Facebook or Instagram for campaign posts; YouTube uses the existing clip workflow");
  const connection = await prisma.platformConnection.findFirst({ where: { subscriberId: "social-suite", platform: platform === "facebook" ? `facebook_page:${accountId}` : platform, platformAccountId: accountId, status: "active" } });
  if (!connection) throw new Error("Account is not connected. Reconnect it in Social first.");
  const response = await fetch(`https://graph.facebook.com/v23.0/${accountId}?fields=id`, { headers: { Authorization: `Bearer ${connection.accessToken}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok || (await response.json()).id !== accountId) throw new Error("Account identity check failed. Reconnect in Social.");
  return connection;
}

/** A shared per-account lock coordinates feed limits with clip publishing. */
export async function reserveCampaign(id: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const candidate = await tx.liveCampaignPost.findUnique({ where: { id } });
    if (!candidate) return null;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'treasure-hauls-' + candidate.platform}))`;
    const post = await tx.liveCampaignPost.findUnique({ where: { id } });
    const settings = await tx.liveSettings.findUnique({ where: { id: "treasure-hauls" } });
    if (!post || post.status !== "queued" || post.manual || settings?.campaignPaused !== false) return null;
    if (isAnnouncement(post.kind) && (await tx.growthAutomation.findUnique({ where: { id: "owner" } }))?.announcementsPaused !== false) return null;
    const binding = campaignBinding(settings.bindings as Record<string, Binding>, post);
    if (!binding || binding.accountId !== post.accountId) return null;
    const show = post.showId ? await tx.liveShow.findUnique({ where: { id: post.showId } }) : null;
    const decision = campaignDecision(post, show, now);
    if (decision === "expired" || decision === "canceled") { await tx.liveCampaignPost.update({ where: { id }, data: { status: decision } }); return null; }
    if (decision !== "ready") return null;
    assertAutomatedCopy(post.caption);
    const since = centralInstant(centralDate(now), "00:00");
    if (post.kind === "crossover") {
      const day = new Date(`${centralDate(now)}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
      const weekStart = centralInstant(day.toISOString().slice(0, 10), "00:00");
      if (await tx.liveCampaignPost.count({ where: { kind: "crossover", platform: post.platform, accountId: post.accountId, status: { in: ["posting", "posted", "uncertain"] }, updatedAt: { gte: weekStart } } })) return null;
    }
    const clips = await tx.livePublication.count({ where: { platform: post.platform, accountId: post.accountId, createdAt: { gte: since } } });
    const campaigns = await tx.liveCampaignPost.count({ where: { platform: post.platform, accountId: post.accountId, format: "feed", NOT: { kind: { startsWith: "announce_" } }, status: { in: ["posting", "posted", "uncertain"] }, updatedAt: { gte: since } } });
    const originals = await tx.contentIncomePost.count({ where: { account: { platform: post.platform, externalId: post.accountId }, status: { in: ["sending", "posted", "uncertain"] }, attemptedAt: { gte: since } } });
    if (!isAnnouncement(post.kind) && clips + campaigns + originals >= 2) return null;
    // Preserve the second feed slot for the confirmed evening preview.
    if (!isAnnouncement(post.kind) && post.kind !== "preview" && clips + campaigns + originals >= 1) return null;
    const claimed = await tx.liveCampaignPost.updateMany({ where: { id, status: "queued" }, data: { status: "posting", error: null } });
    return claimed.count === 1 ? post : null;
  });
}

async function publish(post: LiveCampaignPost) {
  const caption = post.caption.startsWith(AFFILIATE_DISCLOSURE) ? post.caption : `${AFFILIATE_DISCLOSURE}\n\n${post.caption}`;
  const connection = await verifyCampaignAccount(post.platform, post.accountId);
  const checkpoint = async (externalId: string) => { await prisma.liveCampaignPost.update({ where: { id: post.id }, data: { externalId } }); };
  // Identity checking is read-only; recheck schedule and pause after it, before the remote mutation.
  const [settings, fresh, show] = await Promise.all([
    prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } }),
    prisma.liveCampaignPost.findUnique({ where: { id: post.id } }),
    post.showId ? prisma.liveShow.findUnique({ where: { id: post.showId } }) : null,
  ]);
  if ((isAnnouncement(post.kind) && (await prisma.growthAutomation.findUnique({ where: { id: "owner" } }))?.announcementsPaused !== false) || settings?.campaignPaused !== false || fresh?.status !== "posting" || campaignBinding(settings.bindings as Record<string, Binding>, post)?.accountId !== post.accountId || campaignDecision(post, show, new Date()) !== "ready") {
    await prisma.liveCampaignPost.updateMany({ where: { id: post.id, status: "posting" }, data: { status: "held", error: "Paused, changed, or show no longer eligible before sending" } });
    return;
  }
  let externalId: string, url: string;
  if (post.platform === "facebook") {
    const response = await fetch(`https://graph.facebook.com/v23.0/${post.accountId}/feed`, { method: "POST", headers: { Authorization: `Bearer ${connection.accessToken}` }, body: new URLSearchParams({ message: caption }), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok || !result.id) throw new Error("Publish not confirmed");
    externalId = result.id; url = `https://www.facebook.com/${externalId}`; await checkpoint(externalId);
  } else {
    if (!post.mediaUrl) throw new Error("Instagram requires a campaign image");
    const result = await postInstagram({ id: post.id, source: "stream", accountId: post.accountId, mediaType: "image", mediaUrl: post.mediaUrl, caption, hashtags: [], onExternalId: checkpoint });
    if (!result.ok) throw new Error("Publish not confirmed");
    externalId = result.externalId; url = result.url;
  }
  await prisma.liveCampaignPost.update({ where: { id: post.id }, data: { status: "posted", externalId, url, error: null } });
  await prisma.postLogEntry.create({ data: { job: "hauls-campaign", runId: post.id, channel: post.platform === "facebook" ? "fb" : "ig", account: post.accountId, business: "haul", status: "ok", title: post.kind, url } });
}

export async function drainCampaign() {
  const now = new Date();
  await prisma.liveCampaignPost.updateMany({ where: { status: "posting", updatedAt: { lt: new Date(now.getTime() - 15 * 60000) } }, data: { status: "uncertain", error: "Worker interrupted. Verify platform before marking posted; no automatic retry." } });
  await prisma.liveCampaignPost.updateMany({ where: { status: { in: ["draft", "queued", "manual", "held"] }, expiresAt: { lt: now } }, data: { status: "expired" } });
  const due = await prisma.liveCampaignPost.findMany({ where: { status: "queued", dueAt: { lte: now } }, orderBy: { dueAt: "asc" }, take: 20 });
  for (const row of due) {
    const post = await reserveCampaign(row.id, now);
    if (!post) continue;
    try { await publish(post); }
    catch {
      await prisma.liveCampaignPost.updateMany({ where: { id: post.id, status: "posting" }, data: { status: "uncertain", error: "Publish not confirmed. Check the bound account; never blindly retry." } });
      await prisma.postLogEntry.create({ data: { job: "hauls-campaign", runId: post.id, channel: post.platform === "facebook" ? "fb" : "ig", account: post.accountId, business: "haul", status: "fail", title: post.kind, error: "Campaign publish requires reconciliation" } });
    }
  }
  const pending = await prisma.liveCampaignPost.count({ where: { status: { in: ["uncertain", "expired"] }, updatedAt: { gte: new Date(now.getTime() - 86400000) } } });
  await prisma.siteEvent.create({ data: { site: "live", path: "/stream/growth", event: "campaign_heartbeat", meta: { due: due.length, needsAttention: pending } } });
  return { checked: due.length, needsAttention: pending };
}
