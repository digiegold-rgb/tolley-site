import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Click-quality breakdown for /shop/dashboard/analytics. Pulls from SiteEvent
 * rows logged by /go/[code] and /api/shop/amazon/[id]. Splits real human
 * clicks from bot/datacenter clicks (UA regex + AWS/GCP IP ranges) so the
 * dashboard reports "5 real / 7 total" instead of celebrating crawler hits.
 *
 * The all-time `Product.amazonClicks` + `Product.goClicks*` counters skip
 * bot increments at write time (see lib/shop/click-classifier.ts), so they
 * reflect real clicks only. This endpoint exists to surface the *suppressed*
 * bot count alongside, both for credibility and to spot-check the classifier.
 */
export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = Math.max(
    1,
    Math.min(180, parseInt(req.nextUrl.searchParams.get("days") || "30", 10)),
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await prisma.siteEvent.findMany({
    where: {
      site: "shop",
      event: { in: ["amazon_click", "go_redirect", "affiliate_click"] },
      createdAt: { gte: since },
    },
    select: {
      event: true,
      label: true,
      meta: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  type Bucket = {
    real: number;
    bot: number;
    bySource: Record<string, { real: number; bot: number }>;
    byBotReason: Record<string, number>;
  };
  const empty = (): Bucket => ({
    real: 0,
    bot: 0,
    bySource: {},
    byBotReason: {},
  });

  const breakdown: Record<string, Bucket> = {
    amazon_click: empty(),
    go_redirect: empty(),
    affiliate_click: empty(),
  };

  for (const e of events) {
    const bucket = breakdown[e.event];
    if (!bucket) continue;
    const meta = (e.meta as Record<string, unknown> | null) ?? {};
    const isBot = Boolean(meta.isBot);
    const reason = (meta.botReason as string | undefined) ?? "unknown";
    const src = ((e.label as string | null) ?? "direct") || "direct";

    if (isBot) {
      bucket.bot += 1;
      bucket.byBotReason[reason] = (bucket.byBotReason[reason] ?? 0) + 1;
    } else {
      bucket.real += 1;
    }
    const srcBucket =
      bucket.bySource[src] ?? (bucket.bySource[src] = { real: 0, bot: 0 });
    if (isBot) srcBucket.bot += 1;
    else srcBucket.real += 1;
  }

  const totalReal =
    breakdown.amazon_click.real +
    breakdown.go_redirect.real +
    breakdown.affiliate_click.real;
  const totalBot =
    breakdown.amazon_click.bot +
    breakdown.go_redirect.bot +
    breakdown.affiliate_click.bot;

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    total: {
      real: totalReal,
      bot: totalBot,
      sampled: events.length,
      botPct: totalReal + totalBot > 0
        ? Math.round((totalBot / (totalReal + totalBot)) * 100)
        : 0,
    },
    breakdown,
  });
}
