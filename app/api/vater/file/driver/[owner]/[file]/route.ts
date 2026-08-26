/**
 * GET /api/vater/file/driver/:owner/:file — stream one Animate-2 driver clip
 * from the DGX (bearer-authed upstream) for the editor's driver picker preview.
 *
 * Visibility mirrors GET /api/vater/drivers: the caller's own namespace, the
 * shared starter library, and the house library on the house lane.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { ownerKeyForUser } from "@/lib/vater/voice-ids";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";

type Ctx = { params: Promise<{ owner: string; file: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { owner, file } = await ctx.params;
  if (!/^(u_[A-Za-z0-9_-]{1,64}|shared|house)$/.test(owner)) {
    return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.mp4$/.test(file) || file.includes("..")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  if (owner.startsWith("u_") && owner !== ownerKeyForUser(session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (owner === "house") {
    const fields = await ownerFieldsForSessionWithLane(session);
    if (fields.ownerLane !== "vater") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json({ error: "Autopilot not configured" }, { status: 500 });
  }
  const upstream = await fetch(`${autopilotUrl}/vater/file/driver/${owner}/${file}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "File unavailable", status: upstream.status },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
