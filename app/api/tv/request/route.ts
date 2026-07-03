import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";

export const dynamic = "force-dynamic";

const OVERSEERR_URL = process.env.OVERSEERR_URL || "https://tv-api.tolley.io";

// Server-side proxy to create an Overseerr request (which triggers Sonarr/Radarr
// to search + download via Transmission, then import into Plex).
export async function POST(req: Request) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.OVERSEERR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OVERSEERR_API_KEY not configured" }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const mediaType = body.mediaType;
  const mediaId = Number(body.mediaId);
  if ((mediaType !== "movie" && mediaType !== "tv") || !mediaId) {
    return NextResponse.json({ error: "mediaType (movie|tv) and mediaId required" }, { status: 400 });
  }

  const payload: any = { mediaType, mediaId };
  // TV requires seasons; "all" grabs the whole series + future episodes (auto-tracking).
  if (mediaType === "tv") payload.seasons = "all";
  // Optional 4K pick (movies only): override the Radarr quality profile for this
  // request. Default server profile is HD-1080p (id 4); Ultra-HD is id 5.
  if (mediaType === "movie" && body.quality === "4k") payload.profileId = 5;

  try {
    const r = await fetch(`${OVERSEERR_URL}/api/v1/request`, {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        { error: `Request failed (${r.status})`, detail: text.slice(0, 300) },
        { status: r.status === 409 ? 409 : 502 }
      );
    }
    return NextResponse.json({ ok: true, request: JSON.parse(text || "{}") });
  } catch (e: any) {
    return NextResponse.json({ error: "proxy error", detail: String(e?.message || e) }, { status: 502 });
  }
}
