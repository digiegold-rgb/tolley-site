import crypto from "crypto";
import nodemailer from "nodemailer";
import type { Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Shared builder for the Treasure Haul "drop list" emails.
 *
 * Two senders use this and must not drift apart (same contract as
 * lib/estate-alert-email.ts):
 *   - the weekly cron (/api/cron/treasure-haul-drop-email), which sends the
 *     week's new arrivals to the whole list;
 *   - the signup autoresponder (/api/email-capture), which sends the newest
 *     items instantly so a new subscriber is never met with silence.
 *
 * WHY THIS EXISTS AT ALL: the shop-drops capture form ran for weeks with no
 * consumer — people opted in and nothing ever sent. See drop-autoresponder.ts.
 *
 * IMPORTANT — what we can and cannot promise:
 * A product's price only becomes trustworthy once a human lists it on FB
 * Marketplace and fb-sync mirrors that real price back into targetPrice
 * (app/api/shop/fb-sync/route.ts). `aiSuggestedPrice` is a photo-derived guess
 * and is NEVER emailed. So we cannot offer "early access before Facebook" —
 * that price does not exist yet. What we offer instead is completeness: every
 * new arrival in one email with a working Buy button, versus the handful
 * Facebook's feed randomly surfaces.
 */

export const OWNER_EMAIL = process.env.LEAD_OWNER_EMAIL || "digiegold@gmail.com";
export const FROM = process.env.EMAIL_FROM || "Treasure Haul <leads@tolley.io>";
export const REPLY_TO = process.env.SHOP_REPLY_TO || "support@tolley.io";
export const SOURCE = "shop-drops";

/** Below this many clean items we skip the week rather than send a thin email. */
export const MIN_ITEMS = 5;
/** Cap so a big backfill week can't produce an endless scroll. */
export const MAX_ITEMS = 12;

/** Tag stamped on an EmailLead once it has been sent a given week's drop. */
export const weekTag = (weekKey: string) => `drop-sent:${weekKey}`;
/** Tag stamped once the instant welcome has gone out, so it only ever fires once. */
export const WELCOME_TAG = "drop-welcomed";

export function getTransporter() {
  const port = Number(process.env.EMAIL_SERVER_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST || "localhost",
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER || "",
      pass: process.env.EMAIL_SERVER_PASSWORD || "",
    },
  });
}

/**
 * ISO-week key (e.g. "2026-W30"). Used for the send-once-per-week tag so a
 * cron retry, a redeploy, or a manual re-run can never double-send.
 */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday of the current week determines the ISO year.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Scrape artifacts that leak in from the FB Marketplace seller-dashboard
 * mirror. Observed live in production titles, e.g.
 *   "Continue Delete draft BRAND NEW LIGHT FIXTURES"
 *   "This listing is being reviewed. 20\" Black Gold Luxury..."
 */
const STRIP_PREFIXES = [/^continue\s+delete\s+draft\s+/i, /^delete\s+draft\s+/i];
/** "Being reviewed" means FB may not even be showing it — never email those. */
const REJECT_PATTERNS = [/this listing is being reviewed/i, /^\s*$/];

export function cleanTitle(raw: string): string {
  let t = raw;
  for (const re of STRIP_PREFIXES) t = t.replace(re, "");
  return t.replace(/\s+/g, " ").trim();
}

export function isSendableTitle(raw: string): boolean {
  const t = cleanTitle(raw);
  if (t.length < 3) return false;
  return !REJECT_PATTERNS.some((re) => re.test(t));
}

export type DropProduct = Pick<
  Product,
  "id" | "title" | "targetPrice" | "imageUrls" | "goSlug" | "category" | "createdAt"
>;

/**
 * The quality gate. Everything here is a guard against emailing something
 * embarrassing or unbuyable:
 *   status/listing  — only items that actually have a live, purchasable listing
 *   targetPrice > 0 — the human-verified FB price, never aiSuggestedPrice
 *   imageUrls       — 98 of 247 listed items have no photo; a photoless email is dead
 *   isSendableTitle — strips/rejects mirror scrape junk
 */
export async function selectDropProducts(opts: {
  sinceDays?: number;
  limit?: number;
}): Promise<DropProduct[]> {
  const { sinceDays, limit = MAX_ITEMS } = opts;
  const rows = await prisma.product.findMany({
    where: {
      status: "listed",
      targetPrice: { gt: 0 },
      NOT: { imageUrls: { isEmpty: true } },
      listings: { some: { platform: "shop", status: "active" } },
      ...(sinceDays
        ? { createdAt: { gte: new Date(Date.now() - sinceDays * 86400000) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    // Over-fetch so title rejections can't starve the result below the gate.
    take: limit * 3,
    select: {
      id: true,
      title: true,
      targetPrice: true,
      imageUrls: true,
      goSlug: true,
      category: true,
      createdAt: true,
    },
  });
  return rows.filter((r) => isSendableTitle(r.title)).slice(0, limit);
}

/**
 * Mirrors buildShopLink in lib/shop/treasure-haul-post.ts: prefer the tracked
 * /go short link, fall back to the direct product URL. Only 87 of 247 listed
 * products have a goSlug, so the fallback is the common path — utm params
 * carry attribution there.
 */
export function buildDropLink(p: Pick<DropProduct, "id" | "goSlug">): string {
  if (p.goSlug) return `https://www.tolley.io/go/${p.goSlug}?src=email`;
  return `https://www.tolley.io/shop/${p.id}?utm_source=drop_email&utm_medium=email`;
}

const money = (n: number | null) =>
  n == null ? "" : `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;

/** Signed unsubscribe token — avoids a schema migration for a token column. */
export function unsubToken(email: string): string {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Without a real secret the token is guessable and anyone could
    // unsubscribe anyone. CRON_SECRET is set in Vercel production; this only
    // trips in a misconfigured environment, and it should be loud when it does.
    console.error(
      "[drop-email] CRON_SECRET/NEXTAUTH_SECRET unset — unsubscribe tokens are NOT secure",
    );
  }
  return crypto
    .createHmac("sha256", secret || "treasure-haul-insecure-fallback")
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function unsubUrl(email: string): string {
  const q = new URLSearchParams({ e: email, t: unsubToken(email) });
  return `https://www.tolley.io/api/shop/drops/unsubscribe?${q}`;
}

function itemHtml(p: DropProduct): string {
  const url = buildDropLink(p);
  const img = p.imageUrls[0];
  const title = cleanTitle(p.title);
  return `
  <tr>
    <td style="padding:0 0 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e1d7;border-radius:10px;overflow:hidden;background:#fff">
        <tr>
          <td width="132" valign="top" style="padding:0">
            <a href="${url}"><img src="${img}" width="132" alt="${title.replace(/"/g, "&quot;")}" style="display:block;width:132px;height:132px;object-fit:cover;border:0"></a>
          </td>
          <td valign="top" style="padding:14px 16px">
            <a href="${url}" style="font-size:15px;font-weight:600;color:#1a3a5c;text-decoration:none;line-height:1.35">${title}</a>
            <div style="font-size:20px;font-weight:700;color:#9a4a00;margin:8px 0 12px">${money(p.targetPrice)}</div>
            <a href="${url}" style="display:inline-block;background:#9a4a00;color:#fff;font-size:13px;font-weight:600;text-decoration:none;padding:9px 18px;border-radius:999px">Buy it now →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function shell(headline: string, sub: string, items: DropProduct[], email: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f1ea">
<div style="max-width:600px;margin:0 auto;padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937">
  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a4a00;font-weight:700">Treasure Haul · Independence, MO</div>
  <h1 style="font-size:24px;margin:10px 0 6px;color:#1a3a5c">${headline}</h1>
  <p style="font-size:15px;line-height:1.55;margin:0 0 22px;color:#4b5563">${sub}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items.map(itemHtml).join("")}</table>
  <div style="border-top:1px solid #e2ddd2;margin-top:8px;padding-top:18px">
    <p style="font-size:14px;line-height:1.55;color:#4b5563;margin:0 0 6px">
      Everything ships from Independence, MO — or arrange local pickup.
      Questions, or want to haggle? Just reply to this email, or write us at
      <a href="mailto:${REPLY_TO}" style="color:#9a4a00">${REPLY_TO}</a>.
    </p>
    <p style="font-size:14px;margin:0 0 18px"><a href="https://www.tolley.io/shop?utm_source=drop_email&utm_medium=email" style="color:#9a4a00;font-weight:600">Browse the full haul →</a></p>
    <p style="font-size:12px;color:#9ca3af;margin:0">
      You're getting this because you joined the Treasure Haul drop list.
      <a href="${unsubUrl(email)}" style="color:#9ca3af">Unsubscribe</a>
    </p>
  </div>
</div></body></html>`;
}

function textVersion(headline: string, items: DropProduct[], email: string): string {
  const lines = items.map(
    (p) => `- ${cleanTitle(p.title)} — ${money(p.targetPrice)}\n  ${buildDropLink(p)}`,
  );
  return [
    headline,
    "",
    ...lines,
    "",
    "Ships from Independence, MO, or arrange local pickup.",
    `Questions or want to haggle? Reply to this email or write ${REPLY_TO}.`,
    "",
    "Browse the full haul: https://www.tolley.io/shop",
    `Unsubscribe: ${unsubUrl(email)}`,
  ].join("\n");
}

export function buildWelcomeEmail(items: DropProduct[], email: string) {
  const headline = "You're on the drop list.";
  const sub =
    "Here's what's in the shop right now. Every week you'll get the new arrivals — all of them, not whatever Facebook decides to show you — and you can buy straight from the email.";
  return {
    subject: `You're in — ${items.length} finds in the shop right now`,
    html: shell(headline, sub, items, email),
    text: textVersion(`${headline}\n${sub}`, items, email),
  };
}

export function buildWeeklyDropEmail(items: DropProduct[], email: string) {
  const headline = `${items.length} new finds this week`;
  const sub =
    "Fresh in the shop. Prices are what we actually list them at — tap any item to buy it on the spot.";
  return {
    subject: `${items.length} new finds just landed at Treasure Haul`,
    html: shell(headline, sub, items, email),
    text: textVersion(`${headline}\n${sub}`, items, email),
  };
}
