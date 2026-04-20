/**
 * POST /api/vater/youtube/styles/[id]/references
 *
 * Body: { urls: string[] (1-6 YouTube URLs) }
 * Effect: kicks off DGX transcribe job. Returns { jobId } for client polling.
 *         DGX worker calls back to /references/callback when done, which
 *         appends the new transcripts to the Style's referenceTranscripts JSON.
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
  if (!style) {
    return NextResponse.json({ error: "Style not found" }, { status: 404 });
  }
  if (style.userId && style.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (style.isSystem) {
    return NextResponse.json(
      { error: "System styles are immutable. Clone first." },
      { status: 403 },
    );
  }

  let body: { urls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const urls = (body.urls || []).filter(
    (u) => typeof u === "string" && u.includes("://"),
  );
  if (urls.length === 0 || urls.length > 6) {
    return NextResponse.json(
      { error: "urls must be a non-empty array of up to 6 YouTube URLs" },
      { status: 400 },
    );
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json(
      { error: "Autopilot not configured (AUTOPILOT_URL/CONTENT_API_KEY)" },
      { status: 500 },
    );
  }

  const callbackUrl = `${publicSiteUrl()}/api/vater/youtube/styles/${id}/references/callback`;

  try {
    const r = await fetch(`${autopilotUrl}/vater/styles/${id}/references`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls, callbackUrl }),
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
