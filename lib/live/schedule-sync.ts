import { prisma } from "../prisma";
import { campaignPack } from "./campaign";
import { SCHEDULE_PREFIX, SCHEDULE_LEASE_MS, type ObservedShow } from "./schedule-core";
import type { Binding } from "./campaign-publish";
const unsent = ["draft", "queued", "manual", "expired", "canceled"];
/** No remote publishing here: the existing campaign publisher owns delivery and rate limits. */
export async function reconcileWhatnotSchedule(shows: ObservedShow[], observedAt = new Date()) {
  if (Math.abs(Date.now() - observedAt.getTime()) > 5 * 60000) throw new Error("Schedule observation is stale");
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('whatnot-schedule-sync'))`;
    const settings = await tx.liveSettings.findUnique({ where: { id: "treasure-hauls" } });
    const bindings = (settings?.bindings || {}) as Record<string, Binding>;
    const existing = await tx.liveShow.findMany({ where: { id: { startsWith: SCHEDULE_PREFIX } } });
    const ids = new Set(shows.map(s => s.id));
    let imported = 0, changed = 0, removed = 0;
    for (const old of existing) {
      if (!ids.has(old.id) && old.status === "confirmed" && old.startsAt > observedAt) {
        await tx.liveShow.update({ where: { id: old.id }, data: { status: "source_missing", confirmedUntil: null } });
        await tx.liveCampaignPost.updateMany({ where: { showId: old.id, status: { in: unsent } }, data: { status: "canceled" } });
        await tx.liveCampaignPost.updateMany({ where: { showId: old.id, status: "posting" }, data: { status: "uncertain", error: "Whatnot schedule changed during delivery. Verify the platform before retrying." } });
        removed++;
      }
    }
    for (const observed of shows) {
      const old = existing.find(s => s.id === observed.id);
      // Owner cancellations and actual live/ended state take priority over automation.
      if (old && ["canceled", "live", "ended"].includes(old.status)) continue;
      if (!old && await tx.liveShow.findFirst({ where: { whatnotUrl: observed.whatnotUrl } })) continue;
      const revised = !!old && (old.title !== observed.title || old.startsAt.getTime() !== observed.startsAt.getTime() || old.status === "source_missing");
      const show = await tx.liveShow.upsert({ where: { id: observed.id }, create: { ...observed, category: "Estate / mixed finds", durationMin: 120, status: "confirmed", confirmedUntil: new Date(observedAt.getTime() + SCHEDULE_LEASE_MS) }, update: { ...observed, status: "confirmed", confirmedUntil: new Date(observedAt.getTime() + SCHEDULE_LEASE_MS) } });
      if (!old) imported++;
      if (revised) {
        changed++;
        await tx.liveCampaignPost.updateMany({ where: { showId: show.id, status: "posting" }, data: { status: "uncertain", error: "Whatnot schedule changed during delivery. Verify the platform before retrying." } });
      }
      for (const platform of ["facebook", "instagram"]) {
        const accountId = bindings[platform]?.accountId;
        if (!accountId) continue;
        for (const post of campaignPack(show)) {
          const expiresAt = post.kind === "live" ? new Date(show.startsAt.getTime() + 3600000) : post.kind === "preview" ? show.startsAt : new Date(post.dueAt.getTime() + 15 * 60000);
          const data = { ...post, showId: show.id, platform, accountId, expiresAt,
            status: expiresAt <= observedAt ? "expired" : post.manual ? "manual" : "queued",
            caption: post.caption.replaceAll("utm_source=facebook", `utm_source=${platform}`),
            mediaUrl: platform === "instagram" && post.format === "feed" ? "https://www.tolley.io/treasure-hauls/feed.jpg" : `https://www.tolley.io/live/poster?show=${show.id}&format=${post.format}` };
          const key = { showId: show.id, kind: post.kind, platform, accountId };
          const prior = await tx.liveCampaignPost.findUnique({ where: { showId_kind_platform_accountId: key } });
          if (!prior) await tx.liveCampaignPost.create({ data });
          else if (revised && (unsent.includes(prior.status) || prior.status === "held")) await tx.liveCampaignPost.update({ where: { id: prior.id }, data: { ...data, status: prior.status === "held" ? "held" : data.status } });
          // Held, posting, posted and uncertain posts are never released or replayed.
        }
      }
    }
    const result = { status: "ok", observedAt: observedAt.toISOString(), count: shows.length, imported, changed, removed, nextShow: shows[0]?.startsAt.toISOString() || null };
    await tx.siteEvent.create({ data: { site: "live", path: "/stream/growth", event: "whatnot_schedule_sync", meta: result } });
    return result;
  }, { timeout: 30000 });
}
