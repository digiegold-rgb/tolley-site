import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { generateCaption, type CaptionPlatform } from "@/lib/social/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID: Set<CaptionPlatform> = new Set([
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
]);

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    platforms?: string[];
    hint?: string;
    topic?: string;
  };

  const platforms = (body.platforms ?? []).filter((p): p is CaptionPlatform =>
    VALID.has(p as CaptionPlatform),
  );

  try {
    const result = await generateCaption({
      platforms,
      hint: body.hint,
      topic: body.topic,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "caption gen failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
