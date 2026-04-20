/**
 * GET   /api/vater/youtube/styles/[id]/characters    — list characters
 * POST  /api/vater/youtube/styles/[id]/characters    — kick off generator job
 *
 * The POST returns { jobId } immediately; the DGX worker calls
 * /characters/callback when descriptor + ref image are ready.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { publicSiteUrl } from "@/lib/vater/site-url";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
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
  return NextResponse.json({ characters: style.characters });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const style = await prisma.youTubeStyle.findUnique({
    where: { id },
    include: { customArtStyle: true },
  });
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

  let body: { name?: string; brief?: string; briefDescription?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const brief = (body.brief || body.briefDescription || "").trim();
  if (!name || name.length > 80) {
    return NextResponse.json(
      { error: "name (1-80 chars) required" },
      { status: 400 },
    );
  }
  if (!brief || brief.length < 8) {
    return NextResponse.json(
      { error: "brief (≥8 chars) required" },
      { status: 400 },
    );
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json(
      { error: "Autopilot not configured" },
      { status: 500 },
    );
  }

  const callbackUrl = `${publicSiteUrl()}/api/vater/youtube/styles/${id}/characters/callback`;
  try {
    const r = await fetch(`${autopilotUrl}/vater/characters/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        styleId: id,
        name,
        briefDescription: brief,
        customArtStyleDescription: style.customArtStyle?.description ?? null,
        callbackUrl,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json(
        {
          error: "Autopilot kickoff failed",
          status: r.status,
          detail: detail.slice(0, 500),
        },
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
