import { z } from "zod";
import { AFFILIATE_DISCLOSURE } from "./impact-core";

export const SHOW_ZONE = "America/Chicago";
export const SHOW_TIME = "8:31 PM Central";
export const SHOW_TAGLINE = "Come for the show. Stay for the steals.";
export const REFERRAL_URL = "https://www.whatnot.com/invite/treasure_hauls";
export const SHIPPING_COPY = "Evening orders ship the next business day. Free local pickup by arrangement in the Kansas City area.";
export const SHOW_DESCRIPTION = `Treasure Hauls is a live shopping show with Jared and Ruthann, usually at ${SHOW_TIME}. Real finds, audience picks, and unexpected deals. Check the confirmed schedule. ${SHIPPING_COPY} Sourcing inquiries: call/text 913-283-3826.`;
export const CAMPAIGN_BUDGET = { ads: 200, production: 50, reserve: 50, total: 300 };
export const FEATURE_WEEK = ["Weekly best moments", "Deal of the night", "Guess the final bid", "Weird find Wednesday", "You pick the table", "Meet the hosts", "Packing the haul"];

export type ShowState = { id?: string; status: string; startsAt: Date; confirmedUntil: Date | null; endedAt: Date | null };
export function isLive(s: ShowState, now = new Date()) {
  return s.status === "live" && !s.endedAt && !!s.confirmedUntil && s.confirmedUntil > now;
}
export function canPromote(s: ShowState, now = new Date()) {
  return !s.endedAt && ((s.status === "confirmed" && s.startsAt > now && (!s.id?.startsWith("whatnot_") || (!!s.confirmedUntil && s.confirmedUntil > now))) || isLive(s, now));
}
export function centralDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOW_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** Resolve a Chicago wall clock independently of the server/browser timezone. Reject DST gaps. */
export function centralInstant(date: string, time = "20:31") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Invalid Central date/time");
  const target = `${date}T${time}`;
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: SHOW_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const wall = Date.parse(`${target}:00Z`);
  for (const offset of [5, 6]) {
    const d = new Date(wall + offset * 3600000);
    if (Number.isFinite(d.getTime()) && formatter.format(d).replace(" ", "T") === target) return d;
  }
  throw new Error("That Central time does not exist; choose another time");
}
export const formatShowTime = (date: Date) => new Intl.DateTimeFormat("en-US", { timeZone: SHOW_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
export const dealSchema = z.object({
  showId: z.string().min(1), item: z.string().trim().min(2).max(120),
  price: z.number().finite().min(0).max(100000), soldAt: z.iso.datetime({ offset: true }),
  evidence: z.string().trim().min(5).max(500), verified: z.literal(true),
});
export const metricsSchema = z.object({
  viewers: z.number().int().min(0).nullable(), bookmarks: z.number().int().min(0).nullable(),
  source: z.string().trim().min(3).max(200), measuredAt: z.iso.datetime({ offset: true }),
});
export type CampaignKind = "preview" | "poll" | "countdown" | "live" | "highlight" | "recap" | "crossover" | "fact";
export function campaignPack(s: { id: string; title: string; startsAt: Date }) {
  const when = formatShowTime(s.startsAt);
  const link = `https://www.tolley.io/live?utm_source=facebook&utm_campaign=show_${s.id}#schedule`;
  return [
    { kind: "poll", format: "story", dueAt: new Date(s.startsAt.getTime() - 391 * 60000), caption: "You pick what hits the table first! Add two categories from tonight’s actual lineup, then use the Story poll sticker.", manual: true },
    { kind: "preview", format: "feed", dueAt: new Date(s.startsAt.getTime() - 121 * 60000), caption: `Next up: ${s.title} 👀\n${when}. Bring your questions and grab a seat.\n${SHOW_TAGLINE}\nBookmark the show: ${link}`, manual: false },
    { kind: "countdown", format: "story", dueAt: new Date(s.startsAt.getTime() - 16 * 60000), caption: `16 minutes. Grab a seat. We’re getting the table ready.\nTreasure Hauls · ${when}\n${link}`, manual: true },
    { kind: "live", format: "story", dueAt: s.startsAt, caption: `WE’RE LIVE 🔴 Come hang with Treasure Hauls. See what hits the table next.\n${link}`, manual: true },
  ].map(post => ({ ...post, caption: `${AFFILIATE_DISCLOSURE}\n\n${post.caption}` }));
}
export function campaignDecision(p: { kind: string; dueAt: Date; expiresAt: Date }, s: ShowState | null, now: Date) {
  if (now > p.expiresAt) return "expired";
  if (s?.status === "canceled") return "canceled";
  if (now < p.dueAt) return "wait";
  if (["preview", "poll", "countdown", "live"].includes(p.kind) || p.kind.startsWith("announce_")) {
    if (!s) return "canceled";
    if (p.kind === "live" || p.kind.startsWith("announce_")) return isLive(s, now) ? "ready" : s.endedAt || s.status === "ended" ? "canceled" : "wait";
    if (!canPromote(s, now)) return s.status === "ended" || s.endedAt ? "canceled" : "wait";
  }
  return "ready";
}
export function assertAutomatedCopy(caption: string) {
  if (/whatnot\.com\/invite\b|\/go\/whatnot\b|referral|signup.credit/i.test(caption)) throw new Error("Referral invitations are manual only");
  const disclosed = caption.startsWith(AFFILIATE_DISCLOSURE) ? caption : `${AFFILIATE_DISCLOSURE}\n\n${caption}`;
  if (disclosed.length > 2200) throw new Error("Shorten the caption so it fits 2,200 characters including the affiliate disclosure");
}
