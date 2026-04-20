/**
 * GET  /api/vater/youtube/custom-art-styles  — list user's CustomArtStyles
 * POST /api/vater/youtube/custom-art-styles  — create + kick off describer job
 *
 * Body for POST: { name: string, referenceImageUrls: string[] (3-5) }
 *
 * Creates the row immediately with empty description; DGX worker fills
 * the description via /callback when Gemini Flash returns.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { publicSiteUrl } from "@/lib/vater/site-url";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await prisma.customArtStyle.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ customArtStyles: items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; referenceImageUrls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const urls = (body.referenceImageUrls || []).filter(
    (u) => typeof u === "string" && u.includes("://"),
  );
  if (!name || name.length > 80) {
    return NextResponse.json(
      { error: "name (1-80 chars) required" },
      { status: 400 },
    );
  }
  if (urls.length < 3 || urls.length > 5) {
    return NextResponse.json(
      { error: "referenceImageUrls must be 3-5 URLs" },
      { status: 400 },
    );
  }

  // Create the row immediately so the user has an id to attach to a Style
  const created = await prisma.customArtStyle.create({
    data: {
      userId: session.user.id,
      name,
      // Description is filled by the DGX callback. Empty placeholder until then.
      description: "",
      referenceImageUrls: urls,
      thumbnailUrl: urls[0],
    },
  });

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    // Created the row but autopilot isn't configured — return success
    // with the row so the user can manually edit the description later.
    return NextResponse.json(
      {
        customArtStyle: created,
        warning: "Autopilot not configured; description will be empty.",
      },
      { status: 201 },
    );
  }

  const callbackUrl = `${publicSiteUrl()}/api/vater/youtube/custom-art-styles/callback`;
  try {
    const r = await fetch(`${autopilotUrl}/vater/custom-art-styles/describe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customArtStyleId: created.id,
        name,
        referenceImageUrls: urls,
        callbackUrl,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json(
        {
          customArtStyle: created,
          warning: `Describer kickoff failed (${r.status}): ${detail.slice(0, 300)}`,
        },
        { status: 201 },
      );
    }
    const data = (await r.json()) as { jobId: string };
    return NextResponse.json(
      { customArtStyle: created, jobId: data.jobId },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        customArtStyle: created,
        warning: `Describer unreachable: ${err instanceof Error ? err.message : "unknown"}`,
      },
      { status: 201 },
    );
  }
}
