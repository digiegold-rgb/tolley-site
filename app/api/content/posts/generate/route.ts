import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateContent } from "@/lib/content/generate";
import type { ContentCategory, ContentGenerateInput, PlatformType } from "@/lib/content/types";

/**
 * POST /api/content/posts/generate
 * AI-generate content from listing/client/dossier context.
 *
 * Body: {
 *   subscriberId, platform, category, tone?,
 *   listingId?, clientId?, dossierJobId?,
 *   customInstructions?, saveDraft?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    subscriberId,
    platform,
    category,
    tone,
    listingId,
    clientId,
    dossierJobId,
    customInstructions,
    saveDraft = true,
  } = body;

  if (!subscriberId || !platform || !category) {
    return NextResponse.json(
      { error: "subscriberId, platform, category required" },
      { status: 400 }
    );
  }

  // Load context data
  const input: ContentGenerateInput = {
    platform: platform as PlatformType,
    category: category as ContentCategory,
    tone,
    customInstructions,
  };

  if (listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        address: true,
        city: true,
        zip: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        daysOnMarket: true,
        status: true,
        propertyType: true,
        photoUrls: true,
      },
    });
    if (listing) input.listing = listing;
  }

  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        firstName: true,
        lastName: true,
        buyerSeller: true,
        preferredCities: true,
        moveTimeline: true,
      },
    });
    if (client) input.client = client;
  }

  if (dossierJobId) {
    const result = await prisma.dossierResult.findUnique({
      where: { jobId: dossierJobId },
      select: {
        motivationScore: true,
        motivationFlags: true,
        researchSummary: true,
        owners: true,
      },
    });
    if (result) {
      input.dossier = {
        motivationScore: result.motivationScore,
        motivationFlags: result.motivationFlags,
        researchSummary: result.researchSummary,
        owners: result.owners as unknown[] | undefined,
      };
    }
  }

  try {
    const generated = await generateContent(input, { subscriberId });

    let post = null;
    if (saveDraft) {
      post = await prisma.contentPost.create({
        data: {
          subscriberId,
          platform,
          contentType: "text",
          body: generated.body,
          hashtags: generated.hashtags,
          aiPromptUsed: generated.aiPromptUsed,
          listingId: listingId || null,
          clientId: clientId || null,
          dossierJobId: dossierJobId || null,
          status: "draft",
        },
      });
    }

    return NextResponse.json({
      generated: {
        body: generated.body,
        hashtags: generated.hashtags,
        tokensUsed: generated.tokensUsed,
      },
      post,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    console.error("[content/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
