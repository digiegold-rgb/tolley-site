import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { ledgerSchema, showSchema } from "@/lib/live/core";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [settings, shows, clips, clicks] = await Promise.all([
    prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } }),
    prisma.liveShow.findMany({ orderBy: { startsAt: "desc" }, take: 30 }),
    prisma.liveClip.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { publications: true } }),
    prisma.siteEvent.groupBy({ by: ["label"], where: { site: "live", event: "whatnot_click", createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, _count: true }),
  ]);
  return NextResponse.json({ settings, shows, clips, clicks }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const b = await req.json();
    if (b.action === "show") {
      const data = showSchema.parse(b.show);
      await prisma.liveShow.create({ data: { ...data, startsAt: new Date(data.startsAt) } });
    } else if (b.action === "confirm" || b.action === "end") {
      if (typeof b.id !== "string") throw new Error("Show required");
      const show = await prisma.liveShow.findUniqueOrThrow({ where: { id: b.id } });
      await prisma.liveShow.update({ where: { id: show.id }, data: b.action === "end" ? { endedAt: new Date() } : { endedAt: null, confirmedUntil: new Date(Date.now() + show.durationMin * 60000) } });
    } else if (b.action === "ledger") {
      if (typeof b.id !== "string") throw new Error("Show required");
      await prisma.liveShow.update({ where: { id: b.id }, data: { ledger: ledgerSchema.parse(b.ledger) } });
    } else if (b.action === "pause" && typeof b.paused === "boolean") {
      await prisma.liveSettings.upsert({ where: { id: "treasure-hauls" }, create: { publishingPaused: b.paused }, update: { publishingPaused: b.paused } });
    } else if (b.action === "hold" && typeof b.id === "string") {
      await prisma.liveClip.update({ where: { id: b.id }, data: { status: "held" } });
    } else throw new Error("Unknown action");
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not save. Check the show URL, time and required fields." }, { status: 400 }); }
}
