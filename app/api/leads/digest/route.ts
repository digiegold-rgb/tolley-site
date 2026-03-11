import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatLeadDigest } from "@/lib/lead-scoring";

export const runtime = "nodejs";

/**
 * GET /api/leads/digest
 *
 * Returns today's top leads formatted for Telegram/Discord.
 * Query params:
 *   ?limit=10    — number of leads (default 10)
 *   ?format=text — plain text (default), or "json"
 */
export async function GET(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit")) || 10, 50);
  const format = params.get("format") || "text";

  const leads = await prisma.lead.findMany({
    where: {
      status: "new",
      score: { gte: 25 },
    },
    include: {
      listing: {
        select: {
          address: true,
          listPrice: true,
          daysOnMarket: true,
          listingUrl: true,
          city: true,
          zip: true,
          beds: true,
          baths: true,
          sqft: true,
        },
      },
    },
    orderBy: { score: "desc" },
    take: limit,
  });

  if (format === "json") {
    return NextResponse.json({ leads });
  }

  // Format for Telegram/Discord
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let text = `**T-Agent Daily Lead Digest — ${today}**\n`;
  text += `${leads.length} motivated seller${leads.length !== 1 ? "s" : ""} found\n\n`;

  if (leads.length === 0) {
    text += "No new leads above threshold today. Check back tomorrow.\n";
  }

  for (const lead of leads) {
    if (!lead.listing) continue;
    text += formatLeadDigest({
      score: lead.score,
      address: lead.listing.address,
      listPrice: lead.listing.listPrice,
      daysOnMarket: lead.listing.daysOnMarket,
      summary: lead.notes || "",
      listingUrl: lead.listing.listingUrl || "",
    });
    text += "\n---\n";
  }

  // Stats
  const stats = await prisma.lead.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  text += "\n**Pipeline:**\n";
  for (const s of stats) {
    text += `• ${s.status}: ${s._count.id}\n`;
  }

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
