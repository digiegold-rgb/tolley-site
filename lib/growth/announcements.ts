import { prisma } from "@/lib/prisma";
import { announcementSlot } from "./core";
import { AFFILIATE_DISCLOSURE } from "@/lib/live/impact-core";
import type { Binding } from "@/lib/live/campaign-publish";
export async function scheduleAnnouncements(now = new Date()) {
  const [controls, settings] = await Promise.all([prisma.growthAutomation.findUnique({ where: { id: "owner" } }), prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } })]);
  if (controls?.announcementsPaused !== false || settings?.campaignPaused !== false) return;
  const shows = await prisma.liveShow.findMany({ where: { status: "live", endedAt: null, confirmedUntil: { gt: now }, liveStartedAt: { not: null } } });
  for (const show of shows) {
    const window = announcementSlot(show, now);
    if (!window) continue;
    const seen = new Set<string>();
    for (const [key, binding] of Object.entries((settings.bindings || {}) as Record<string, Binding>)) {
      const crossover = key.startsWith("crossover:");
      if (crossover && window.slot !== 0) continue;
      const platform = crossover ? key.split(":")[1] : key;
      if (!binding.accountId || seen.has(`${platform}:${binding.accountId}`)) continue;
      seen.add(`${platform}:${binding.accountId}`);
      const kind = `announce_${window.slot === 0 ? "start" : "reminder"}_${window.slot}`;
      const link = `https://www.tolley.io/live?${new URLSearchParams({ show: show.id, utm_source: platform, utm_campaign: `live_${show.id}`, utm_content: `${binding.accountId}_${window.slot}` })}`;
      const hooks = ["We’re live! Come see what hits the table.", "Still hanging out with Treasure Hauls. Join the live show!", "Got a minute? Come browse the next finds with us."];
      const caption = `${AFFILIATE_DISCLOSURE}\n\n${hooks[window.slot % hooks.length]}\n${show.title}\n${link}`;
      const supported = ["facebook", "instagram"].includes(platform);
      await prisma.liveCampaignPost.createMany({ data: { showId: show.id, kind, format: "feed", platform, accountId: binding.accountId, caption, mediaUrl: platform === "instagram" ? "https://www.tolley.io/live/announcement-image" : null, dueAt: window.dueAt, expiresAt: window.expiresAt, manual: !supported, status: supported ? "queued" : "unsupported", error: supported ? null : "This connector cannot publish a live announcement. YouTube video clips remain separate." }, skipDuplicates: true });
    }
  }
}
