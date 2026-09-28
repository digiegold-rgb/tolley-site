import { prisma } from "@/lib/prisma";
import { canPromote } from "./campaign";
import { WHATNOT_PROFILE } from "./core";

export async function livePublicData() {
  const now = new Date();
  const [settings, shows, clips, deals] = await Promise.all([
    prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } }),
    prisma.liveShow.findMany({ where: { status: { in: ["confirmed", "live"] }, endedAt: null, OR: [{ startsAt: { gte: now } }, { confirmedUntil: { gt: now } }] }, orderBy: { startsAt: "asc" }, take: 7,
      select: { id: true, status: true, endedAt: true, title: true, category: true, startsAt: true, durationMin: true, whatnotUrl: true, confirmedUntil: true } }),
    prisma.liveClip.findMany({ where: { status: "ready", publications: { some: { status: "posted" } } }, take: 6, orderBy: { createdAt: "desc" }, select: { id: true, title: true, mediaUrl: true } }),
    prisma.liveDeal.findMany({ where: { verified: true }, orderBy: { soldAt: "desc" }, take: 6, select: { id: true, item: true, priceCents: true, soldAt: true } }),
  ]);
  return { dailyTime: settings?.dailyTime, watchUrl: WHATNOT_PROFILE, shows: shows.filter(s => canPromote(s, now)), clips, deals };
}
