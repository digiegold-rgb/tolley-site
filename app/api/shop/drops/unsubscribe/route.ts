import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REPLY_TO, unsubToken } from "@/lib/shop/drop-email";

export const runtime = "nodejs";

/**
 * The email is attacker-controlled input reflected into the response body, so
 * it is escaped before it ever reaches the HTML. The HMAC gate above makes a
 * crafted address impractical to reach this far, but "unreachable today"
 * is not a reason to interpolate raw input into markup.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Constant-time compare so the token can't be recovered by timing. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/shop/drops/unsubscribe?e=<email>&t=<token>
 *
 * One-click opt-out from the Treasure Haul drop list. The token is an HMAC of
 * the email (see unsubToken) so a stranger can't unsubscribe someone else by
 * guessing addresses, and so we didn't need a schema migration for a token
 * column. Flips optedIn=false, which every sender already respects.
 */

function page(title: string, body: string, status: number): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} · Treasure Haul</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:64px 24px">
  <div style="background:#fff;border:1px solid #e2ddd2;border-radius:10px;padding:36px 32px;box-shadow:0 10px 30px rgba(31,41,55,0.08)">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a4a00;font-weight:700">Treasure Haul</div>
    <h1 style="font-size:26px;margin:14px 0 10px;color:#1a3a5c">${title}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0;color:#374151">${body}</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:18px">
    tolley.io · Independence, MO · <a href="mailto:${REPLY_TO}" style="color:#9ca3af">${REPLY_TO}</a>
  </p>
</div>
</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("e") || "").trim().toLowerCase();
  const token = (url.searchParams.get("t") || "").trim();

  if (!email || !token || !tokenMatches(token, unsubToken(email))) {
    return page("Link not valid", "That unsubscribe link is missing or expired. Reply to any of our emails and we'll take you off the list by hand.", 404);
  }

  const lead = await prisma.emailLead.findUnique({ where: { email }, select: { id: true } });
  if (!lead) {
    return page("You're not on the list", "We couldn't find that address on the Treasure Haul drop list — nothing more to do.", 404);
  }

  await prisma.emailLead.update({ where: { id: lead.id }, data: { optedIn: false } });

  return page(
    "You're unsubscribed",
    `We won't email <strong>${escapeHtml(email)}</strong> about new drops again. The shop stays open at <a href="https://www.tolley.io/shop" style="color:#9a4a00">tolley.io/shop</a> whenever you want to browse.`,
    200,
  );
}
