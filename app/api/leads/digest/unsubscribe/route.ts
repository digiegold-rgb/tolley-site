/**
 * GET /api/leads/digest/unsubscribe?token=<unsubscribeToken>
 *
 * One-click pause link from the Monday digest footer. Token lookup → flips
 * the DigestSubscriber to "paused" (billing is NOT touched here — the agent
 * manages that via Stripe; pausing just stops the Monday emails) → simple
 * branded confirmation page. Invalid/missing token → 404.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function page(title: string, body: string, status: number): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} · KC Motivated Seller Digest</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:64px 24px">
  <div style="background:#fff;border:1px solid #e2ddd2;border-radius:10px;padding:36px 32px;box-shadow:0 10px 30px rgba(31,41,55,0.08)">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a4a00;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700">KC Motivated Seller Digest</div>
    <h1 style="font-size:26px;margin:14px 0 10px;color:#1a3a5c">${title}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0;color:#374151">${body}</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    tolley.io · Kansas City metro
  </p>
</div>
</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() || "";
  if (!token || token.length > 128) {
    return page("Link not recognized", "This pause link is invalid or has expired.", 404);
  }

  const subscriber = await prisma.digestSubscriber.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, status: true },
  });
  if (!subscriber) {
    return page("Link not recognized", "This pause link is invalid or has expired.", 404);
  }

  if (subscriber.status !== "paused") {
    await prisma.digestSubscriber.update({
      where: { id: subscriber.id },
      data: { status: "paused" },
    });
  }

  return page(
    "Paused.",
    `Your Monday digest is paused — no more emails until you say so. Reply to any digest to resume, or re-subscribe anytime at <a href="/leads/digest" style="color:#1a3a5c">tolley.io/leads/digest</a>.`,
    200
  );
}
