/**
 * POST /api/vater/youtube/styles/[id]/quick-setup
 *
 * Simple-view shortcut: one selfie → creates a 2D-cartoon CustomArtStyle
 * with a known-safe descriptor AND kicks off character creation via the
 * existing autopilot /characters/from-image job. Links the art style to
 * the YouTubeStyle so the user lands on a fully configured style with
 * a single upload.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { publicSiteUrl } from "@/lib/vater/site-url";

type Ctx = { params: Promise<{ id: string }> };

const SAFE_2D_CARTOON_DESCRIPTOR =
  "2D cartoon illustration style with bold clean black outlines and flat cel-shaded coloring — NOT photographic, NOT realistic. Generic everyman cartoon look typical of modern explainer animations and indie adult cartoons. Characters have slightly oversized heads on compact bodies with simple proportions, oval eyes (white sclera #FFFFFF, small black pupils #000000), small rounded noses, simple curved line mouths, and approachable expressions. Warm peachy-tan skin (#F2C49B). Natural hair colors, slightly messy and friendly. Clothing is simple: plain tees, jeans, or casual button-ups in warm natural tones. Backgrounds are flat vector scenes with minimal gradients and a limited palette (saturated blues #286694, warm earth tones, soft greens #4A7A4A). Lighting is flat with hard-edged cel-shading highlights — no volumetric light, no realistic shading, no depth-of-field. Clean, readable, original animation-ready style suitable for YouTube monetization.";

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const style = await prisma.youTubeStyle.findUnique({
    where: { id },
    include: { characters: true },
  });
  if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (style.userId && style.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { photoUrl?: string; characterName?: string; styleName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const photoUrl = (body.photoUrl || "").trim();
  const characterName = (body.characterName || "").trim() || "Me";
  const styleName = (body.styleName || `${characterName}'s 2D Look`).trim();

  if (!photoUrl || !photoUrl.includes("://")) {
    return NextResponse.json({ error: "photoUrl required" }, { status: 400 });
  }

  // 1. Create a CustomArtStyle with the known-safe 2D cartoon descriptor
  //    (skip Gemini — we already know what we want: 2D cartoon, no IP refs)
  const artStyle = await prisma.customArtStyle.create({
    data: {
      userId: session.user.id,
      name: styleName,
      description: SAFE_2D_CARTOON_DESCRIPTOR,
      referenceImageUrls: [photoUrl],
      thumbnailUrl: photoUrl,
    },
  });

  // 2. Link the CustomArtStyle to this YouTubeStyle
  await prisma.youTubeStyle.update({
    where: { id },
    data: { customArtStyleId: artStyle.id },
  });

  // 3. Kick off character creation via autopilot (reuses existing job)
  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  let characterJobId: string | null = null;
  let characterWarning: string | null = null;

  if (autopilotUrl && apiKey) {
    const callbackUrl = `${publicSiteUrl()}/api/vater/youtube/styles/${id}/characters/callback`;
    try {
      const r = await fetch(`${autopilotUrl}/vater/characters/from-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          styleId: id,
          name: characterName,
          imageUrl: photoUrl,
          callbackUrl,
        }),
      });
      if (r.ok) {
        const data = (await r.json()) as { jobId?: string };
        characterJobId = data.jobId || null;
      } else {
        const detail = await r.text();
        characterWarning = `Character kickoff failed (${r.status}): ${detail.slice(0, 200)}`;
      }
    } catch (err) {
      characterWarning = `Autopilot unreachable: ${err instanceof Error ? err.message : "unknown"}`;
    }
  } else {
    characterWarning = "Autopilot not configured — character will not render automatically.";
  }

  return NextResponse.json({
    customArtStyle: artStyle,
    characterJobId,
    warning: characterWarning,
  });
}
