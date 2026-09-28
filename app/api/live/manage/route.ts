import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { ledgerSchema, showSchema } from "@/lib/live/core";
import { campaignPack, centralInstant, dealSchema, metricsSchema, assertAutomatedCopy } from "@/lib/live/campaign";
import { verifyCampaignAccount, type Binding } from "@/lib/live/campaign-publish";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [settings, shows, clips, clicks, campaigns, deals, accounts, heartbeat] = await Promise.all([
    prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } }),
    prisma.liveShow.findMany({ orderBy: { startsAt: "desc" }, take: 30 }),
    prisma.liveClip.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { publications: true } }),
    prisma.siteEvent.groupBy({ by: ["event", "label"], where: { site: "live", event: { in: ["whatnot_click", "show_click", "referral_click", "campaign_visit"] }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, _count: true }),
    prisma.liveCampaignPost.findMany({ orderBy: { dueAt: "desc" }, take: 150 }),
    prisma.liveDeal.findMany({ orderBy: { soldAt: "desc" }, take: 50 }),
    prisma.platformConnection.findMany({ where: { subscriberId: "social-suite", status: "active", OR: [{ platform: { startsWith: "facebook_page:" } }, { platform: "instagram" }] }, select: { platform: true, platformAccountId: true, platformUsername: true } }),
    prisma.siteEvent.findFirst({ where: { event: "campaign_heartbeat", site: "live" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, meta: true } }),
  ]);
  return NextResponse.json({ settings, shows, clips, clicks, campaigns, deals, accounts, heartbeat }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const b = await req.json();
    if (b.action === "show" || b.action === "edit_show") {
      const data = showSchema.parse({ ...b.show, ...(b.show?.centralDate ? { startsAt: centralInstant(b.show.centralDate, b.show.centralTime || "20:31").toISOString() } : {}) });
      if (b.action === "show") await prisma.liveShow.create({ data: { ...data, startsAt: new Date(data.startsAt), status: "scheduled" } });
      else await prisma.$transaction(async tx => {
        const show = await tx.liveShow.findUniqueOrThrow({ where: { id: z.string().parse(b.id) } });
        if (["live", "ended"].includes(show.status)) throw new Error("Live or ended shows cannot be rescheduled");
        await tx.liveShow.update({ where: { id: show.id }, data: { ...data, startsAt: new Date(data.startsAt), status: "scheduled" } });
        await tx.liveCampaignPost.deleteMany({ where: { showId: show.id, status: { in: ["draft", "queued", "manual", "held", "expired", "canceled"] } } });
      });
    } else if (b.action === "schedule_confirm" || b.action === "cancel_show") {
      await prisma.$transaction(async tx => {
        const show = await tx.liveShow.findUniqueOrThrow({ where: { id: z.string().parse(b.id) } });
        if (["live", "ended"].includes(show.status)) throw new Error("Use the ended control for a live show");
        if (b.action === "schedule_confirm" && show.startsAt <= new Date()) throw new Error("Choose a future show time");
        await tx.liveShow.update({ where: { id: show.id }, data: { status: b.action === "schedule_confirm" ? "confirmed" : "canceled" } });
        if (b.action === "cancel_show") await tx.liveCampaignPost.updateMany({ where: { showId: show.id, status: { in: ["queued", "draft", "manual", "held"] } }, data: { status: "canceled" } });
      });
    } else if (b.action === "confirm" || b.action === "end") {
      if (typeof b.id !== "string") throw new Error("Show required");
      const show = await prisma.liveShow.findUniqueOrThrow({ where: { id: b.id } });
      if (b.action === "confirm" && !["confirmed", "live"].includes(show.status)) throw new Error("Confirm the schedule first");
      await prisma.liveShow.update({ where: { id: show.id }, data: b.action === "end" ? { status: "ended", endedAt: new Date() } : { status: "live", endedAt: null, confirmedUntil: new Date(Date.now() + show.durationMin * 60000) } });
      if (b.action === "end") await prisma.liveCampaignPost.updateMany({ where: { showId: show.id, kind: { in: ["preview", "poll", "countdown", "live"] }, status: { in: ["queued", "manual", "draft", "held"] } }, data: { status: "canceled" } });
    } else if (b.action === "ledger") {
      if (typeof b.id !== "string") throw new Error("Show required");
      await prisma.liveShow.update({ where: { id: b.id }, data: { ledger: ledgerSchema.parse(b.ledger) } });
    } else if (b.action === "pause" && typeof b.paused === "boolean") {
      await prisma.liveSettings.upsert({ where: { id: "treasure-hauls" }, create: { publishingPaused: b.paused }, update: { publishingPaused: b.paused } });
    } else if (b.action === "campaign_pause") {
      const paused = z.boolean().parse(b.paused);
      await prisma.liveSettings.upsert({ where: { id: "treasure-hauls" }, create: { campaignPaused: paused }, update: { campaignPaused: paused } });
    } else if (b.action === "bind") {
      const platform = z.enum(["facebook", "instagram"]).parse(b.platform);
      const accountId = z.string().min(1).parse(b.accountId);
      if (b.confirmHaulAccount !== true) throw new Error("Select a dedicated Treasure Hauls account");
      const account = await verifyCampaignAccount(platform, accountId);
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('treasure-hauls-bindings'))`;
        const settings = await tx.liveSettings.findUnique({ where: { id: "treasure-hauls" } });
        const bindings = { ...(settings?.bindings as Record<string, Binding> || {}), [platform]: { accountId, label: account.platformUsername || accountId } };
        await tx.liveSettings.upsert({ where: { id: "treasure-hauls" }, create: { bindings }, update: { bindings } });
      });
    } else if (b.action === "pack") {
      const show = await prisma.liveShow.findUniqueOrThrow({ where: { id: z.string().parse(b.id) } });
      if (show.status !== "confirmed") throw new Error("Confirm the show date before preparing reminders");
      const settings = await prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } });
      const bindings = settings?.bindings as Record<string, Binding> | null;
      for (const platform of ["facebook", "instagram"]) {
        const accountId = bindings?.[platform]?.accountId;
        if (!accountId) continue;
        for (const post of campaignPack(show)) {
          const expiresAt = post.kind === "live" ? new Date(show.startsAt.getTime() + 60 * 60000) : post.kind === "preview" ? show.startsAt : new Date(post.dueAt.getTime() + 15 * 60000);
          await prisma.liveCampaignPost.upsert({ where: { showId_kind_platform_accountId: { showId: show.id, kind: post.kind, platform, accountId } }, create: { ...post, showId: show.id, platform, accountId, expiresAt, status: post.manual ? "manual" : "draft", caption: post.caption.replaceAll("utm_source=facebook", `utm_source=${platform}`), mediaUrl: `https://www.tolley.io/live/poster?show=${show.id}&format=${post.format}` }, update: {} });
        }
      }
    } else if (b.action === "campaign_custom") {
      const kind = z.enum(["fact", "crossover", "recap"]).parse(b.kind);
      const platform = z.enum(["facebook", "instagram"]).parse(b.platform);
      const settings = await prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" } });
      const binding = (settings?.bindings as Record<string, Binding> | null)?.[platform];
      const accountId = kind === "crossover" ? z.string().min(1).parse(b.accountId) : binding?.accountId;
      if (!accountId) throw new Error("Bind a dedicated haul account first");
      if (kind === "crossover" && !await prisma.platformConnection.findFirst({ where: { subscriberId: "social-suite", platform: platform === "facebook" ? `facebook_page:${accountId}` : platform, platformAccountId: accountId, status: "active" } })) throw new Error("Choose a connected account for the selected platform");
      let caption = z.string().trim().min(10).max(1700).parse(b.caption);
      if (kind === "fact") {
        const source = new URL(z.url().parse(b.sourceUrl));
        if (source.protocol !== "https:") throw new Error("Use an HTTPS fact source");
        caption += `\nSource: ${source.toString()}`;
      }
      if (kind === "recap") {
        const deal = await prisma.liveDeal.findFirstOrThrow({ where: { id: z.string().parse(b.dealId), verified: true } });
        caption = `${deal.item} sold for $${(deal.priceCents / 100).toFixed(2)} on ${deal.soldAt.toISOString().slice(0,10)}. Past sale; shipping and tax extra. Every show brings different finds.\nSee the next confirmed show: https://www.tolley.io/live?utm_source=${platform}`;
      }
      assertAutomatedCopy(caption);
      const dueAt = centralInstant(z.string().parse(b.date), z.string().parse(b.time));
      if (dueAt <= new Date()) throw new Error("Choose a future posting time");
      await prisma.liveCampaignPost.create({ data: { kind, platform, accountId, caption, dueAt, expiresAt: new Date(dueAt.getTime() + 3 * 3600000), manual: kind !== "recap" || platform !== "facebook", status: kind === "recap" && platform === "facebook" ? "draft" : "manual" } });
    } else if (b.action === "campaign_edit" || b.action === "campaign_queue" || b.action === "campaign_hold" || b.action === "campaign_posted") {
      const id = z.string().parse(b.id);
      const post = await prisma.liveCampaignPost.findUniqueOrThrow({ where: { id } });
      if (b.action === "campaign_posted") {
        if (!["manual", "uncertain"].includes(post.status)) throw new Error("Only manual or uncertain posts can be reconciled");
        const url = z.url().parse(b.url); const u = new URL(url);
        if (u.protocol !== "https:" || !["www.facebook.com", "facebook.com", "www.instagram.com", "instagram.com"].includes(u.hostname)) throw new Error("Use the published Facebook or Instagram link");
        await prisma.liveCampaignPost.update({ where: { id }, data: { status: "posted", url, error: null } });
      } else {
        if (!["draft", "queued", "held", "manual"].includes(post.status)) throw new Error("This post is already sent, expired, or awaiting reconciliation");
        const caption = z.string().trim().min(10).max(2200).parse(b.caption ?? post.caption);
        assertAutomatedCopy(caption);
        if (b.action === "campaign_queue" && post.manual) throw new Error("Publish this Story manually");
        if (post.expiresAt <= new Date()) throw new Error("This reminder has expired");
        await prisma.liveCampaignPost.update({ where: { id }, data: { caption, status: b.action === "campaign_hold" ? "held" : b.action === "campaign_queue" ? "queued" : post.manual ? "manual" : "draft" } });
      }
    } else if (b.action === "deal" || b.action === "deals_import") {
      const rows = z.array(dealSchema).min(1).max(100).parse(b.action === "deal" ? [b.deal] : b.deals);
      await prisma.$transaction(async tx => {
        for (const row of rows) {
          await tx.liveShow.findUniqueOrThrow({ where: { id: row.showId } });
          const { price, ...data } = row; const soldAt = new Date(data.soldAt);
          if (soldAt > new Date()) throw new Error("Past deals require a completed sale date");
          await tx.liveDeal.upsert({ where: { showId_item_soldAt: { showId: row.showId, item: row.item, soldAt } }, create: { ...data, soldAt, priceCents: Math.round(price * 100) }, update: { priceCents: Math.round(price * 100), evidence: data.evidence, verified: true } });
        }
      });
    } else if (b.action === "deal_hide") {
      await prisma.liveDeal.update({ where: { id: z.string().parse(b.id) }, data: { verified: false } });
    } else if (b.action === "metrics") {
      await prisma.liveShow.update({ where: { id: z.string().parse(b.id) }, data: { metrics: metricsSchema.parse(b.metrics) } });
    } else if (b.action === "hold" && typeof b.id === "string") {
      await prisma.liveClip.update({ where: { id: b.id }, data: { status: "held" } });
    } else throw new Error("Unknown action");
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error && !error.message.includes("prisma") ? error.message.slice(0,250) : "Could not save. Check the show URL, time and required fields." }, { status: 400 }); }
}
