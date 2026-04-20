/**
 * POST /api/vater/youtube/styles/[id]/characters/from-image
 *
 * Create a character using a USER-PROVIDED image (uploaded to Vercel Blob)
 * as the IP-Adapter face anchor. Auto-descriptor via Gemini Vision.
 * The image becomes the SAME image used in every scene render → true
 * brand-mascot consistency, matching TubeGen's character pattern.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { publicSiteUrl } from "@/lib/vater/site-url";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const style = await prisma.youTubeStyle.findUnique({ where: { id } });
  if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (style.userId && style.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (style.isSystem) {
    return NextResponse.json(
      { error: "System styles are immutable. Clone first." },
      { status: 403 },
    );
  }

  let body: { name?: string; imageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const imageUrl = (body.imageUrl || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!imageUrl || !imageUrl.includes("://")) {
    return NextResponse.json({ error: "imageUrl required (must be a URL)" }, { status: 400 });
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json({ error: "Autopilot not configured" }, { status: 500 });
  }
  // Reuse the existing /characters/callback route — same target, same payload shape
  const callbackUrl = `${publicSiteUrl()}/api/vater/youtube/styles/${id}/characters/callback`;

  try {
    const r = await fetch(`${autopilotUrl}/vater/characters/from-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ styleId: id, name, imageUrl, callbackUrl }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json(
        { error: "Autopilot kickoff failed", status: r.status, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }
    const data = (await r.json()) as { jobId: string };
    return NextResponse.json({ jobId: data.jobId });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Autopilot unreachable",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
