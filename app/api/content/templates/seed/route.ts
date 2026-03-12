import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContentCategories, getPlatformInfo } from "@/lib/content/prompts";

/**
 * POST /api/content/templates/seed
 * Seed default real estate content templates for all platform/category combos.
 */
export async function POST(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = getContentCategories();
  const platforms = getPlatformInfo();
  let created = 0;

  for (const cat of categories) {
    for (const plat of platforms) {
      // Check if already exists
      const existing = await prisma.contentTemplate.findFirst({
        where: {
          subscriberId: null,
          platform: plat.platform,
          category: cat.id,
        },
      });

      if (existing) continue;

      await prisma.contentTemplate.create({
        data: {
          subscriberId: null, // system default
          name: `${cat.label} — ${plat.label}`,
          platform: plat.platform,
          category: cat.id,
          promptTemplate: `Generate a ${cat.label.toLowerCase()} post optimized for ${plat.label}. Use the provided context to create compelling, platform-specific content.`,
          tone: plat.platform === "linkedin" ? "professional" : "casual",
          hashtagStrategy: { count: plat.platform === "twitter" ? 3 : 5, style: "niche" },
        },
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, created });
}
