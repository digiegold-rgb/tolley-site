import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";
import { generateCaption, type CaptionPlatform } from "@/lib/social/captions";
import { postOne, type Platform, type PostInput } from "@/lib/social";

export const runtime = "nodejs";
export const maxDuration = 60;

const PLATFORMS: Platform[] = [
  "tiktok",
  "youtube",
  "instagram",
  "facebook",
  "pinterest",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { platforms?: Platform[] };
  const targets =
    body.platforms?.filter((p) => PLATFORMS.includes(p)) ?? [...PLATFORMS];

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!product.videoUrl) {
    return NextResponse.json(
      { error: "Product has no video — upload one first" },
      { status: 400 },
    );
  }

  const ctaUrl = product.goSlug
    ? `https://www.tolley.io/go/${product.goSlug}`
    : `https://www.tolley.io/shop/${product.id}`;

  // Generate one shared caption + hashtags via Qwen3.6 (free, local).
  let caption = product.title;
  let hashtags: string[] = ["#thrifted", "#reseller", "#tolleyshop"];
  try {
    const result = await generateCaption({
      platforms: targets as CaptionPlatform[],
      topic: `Reselling: ${product.title}. Category: ${product.category ?? "—"}. Description: ${product.description ?? "—"}. CTA URL: ${ctaUrl}.`,
    });
    caption = `${result.caption}\n\n${ctaUrl}`;
    hashtags = result.hashtags;
  } catch (err) {
    console.warn("[syndicate] caption gen fallback:", err);
  }

  const post = await prisma.socialPost.create({
    data: {
      source: "shop",
      sourceRefId: product.id,
      mediaUrl: product.videoUrl,
      mediaType: "video",
      title: product.title,
      caption,
      hashtags,
      platforms: targets,
      status: "ready",
    },
  });

  // Fan out in the background — return the dashboard a fast row to show.
  after(async () => {
    const externalIds: Record<string, string> = {};
    const errors: string[] = [];
    let success = 0;
    const input: PostInput = {
      id: post.id,
      source: "shop",
      mediaUrl: post.mediaUrl,
      mediaType: "video",
      title: product.title,
      caption,
      hashtags,
    };
    for (const platform of targets) {
      const r = await postOne(platform, input);
      if (r.ok) {
        externalIds[platform] = r.url || r.externalId;
        success += 1;
      } else {
        externalIds[platform] = `ERROR: ${r.error}`;
        errors.push(`${platform}: ${r.error}`);
      }
    }
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: success > 0 ? "posted" : "failed",
        postedAt: success > 0 ? new Date() : null,
        externalIds,
        errorMessage: errors.length > 0 ? errors.join(" | ") : null,
      },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { syndicatedAt: new Date() },
    });
  });

  revalidatePath("/shop");
  revalidatePath("/social");
  return NextResponse.json({ ok: true, socialPostId: post.id, queued: targets });
}
