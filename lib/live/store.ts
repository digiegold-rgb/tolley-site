import { prisma } from "@/lib/prisma";
import { WHATNOT_PROFILE } from "./core";

export async function livePublicData() {
  const now = new Date();
  const [settings, shows, clips] = await Promise.all([
    prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } }),
    prisma.liveShow.findMany({ where: { endedAt: null, OR: [{ startsAt: { gte: now } }, { confirmedUntil: { gt: now } }] }, orderBy: { startsAt: "asc" }, take: 7,
      select: { id: true, title: true, category: true, startsAt: true, durationMin: true, whatnotUrl: true, confirmedUntil: true } }),
    prisma.liveClip.findMany({ where: { status: "ready", publications: { some: { status: "posted" } } }, take: 6, orderBy: { createdAt: "desc" }, select: { id: true, title: true, mediaUrl: true } }),
  ]);
  return { dailyTime: settings?.dailyTime, watchUrl: WHATNOT_PROFILE, shows, clips };
}
