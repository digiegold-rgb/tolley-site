/**
 * /api/vater/drivers — Animate-2 DRIVER CLIP library (2026-08-27).
 *
 *   GET  → { drivers: [{ id, name, owner, bytes, modifiedAt, url }], max }
 *          own clips first, then the shared starter library, then the house
 *          library when the caller is on the house lane.
 *   POST → multipart { video (mp4, ≤ 40 MB, 3-6 s ideal), name? }
 *          stored in the caller's OWN namespace on the DGX (u_<userId>).
 *
 * A driver clip is the MOTION SOURCE for the "Wan Animate-2 Motion" tier:
 * the character in the still copies the clip's movement. Ids are
 * "<owner>~<stem>" and are only ever resolved inside the caller's visible
 * namespaces on the DGX, so a guessed id from another tenant is a 404.
 *
 * Per-tab (workspace) by construction: the namespace is the session userId.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { ownerKeyForUser } from "@/lib/vater/voice-ids";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const MAX_BYTES = 40 * 1024 * 1024;
const MAX_OWN_DRIVERS = 20;

function upstreamFailure(err: unknown, fallback: string) {
  if (err instanceof AutopilotError) {
    return NextResponse.json(
      { error: err.message || fallback, status: err.status },
      { status: err.status >= 400 && err.status < 500 ? err.status : 502, headers: NO_STORE },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 502, headers: NO_STORE });
}

/** Rewrite DGX file urls to the site proxy (the DGX is bearer-authed). */
function proxied<T extends { url: string; owner: string; name: string }>(d: T): T {
  return { ...d, url: `/api/vater/file/driver/${encodeURIComponent(d.owner)}/${encodeURIComponent(d.name)}.mp4` };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const ownerKey = ownerKeyForUser(session.user.id);
  const fields = await ownerFieldsForSessionWithLane(session);
  try {
    const drivers = await autopilot.getDrivers(ownerKey, fields.ownerLane);
    return NextResponse.json(
      { drivers: drivers.map(proxied), ownerKey, max: MAX_OWN_DRIVERS },
      { headers: NO_STORE },
    );
  } catch (err) {
    return upstreamFailure(err, "Failed to list driver clips");
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const ownerKey = ownerKeyForUser(session.user.id);

  let inForm: FormData;
  try {
    inForm = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400, headers: NO_STORE });
  }
  const video = inForm.get("video");
  const name = inForm.get("name");
  if (!(video instanceof File)) {
    return NextResponse.json({ error: "video file is required" }, { status: 400, headers: NO_STORE });
  }
  if (video.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Driver clip is too large — keep it under 40 MB (3-6 seconds is ideal)." },
      { status: 413, headers: NO_STORE },
    );
  }
  if (!/video\/(mp4|quicktime|webm)/i.test(video.type || "") && !/\.(mp4|mov|webm)$/i.test(video.name || "")) {
    return NextResponse.json({ error: "Upload an .mp4 / .mov / .webm clip." }, { status: 400, headers: NO_STORE });
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json({ error: "Autopilot not configured" }, { status: 500, headers: NO_STORE });
  }

  // Cap: count only the caller's own namespace.
  try {
    const mine = (await autopilot.getDrivers(ownerKey)).filter((d) => d.owner === ownerKey);
    if (mine.length >= MAX_OWN_DRIVERS) {
      return NextResponse.json(
        { error: `You can keep up to ${MAX_OWN_DRIVERS} driver clips — delete one to add another.` },
        { status: 409, headers: NO_STORE },
      );
    }
  } catch (err) {
    return upstreamFailure(err, "Failed to check the driver library");
  }

  const out = new FormData();
  out.append("video", video, video.name || "driver.mp4");
  out.append("name", typeof name === "string" ? name : "");
  out.append("ownerKey", ownerKey);

  const upstream = await fetch(`${autopilotUrl}/vater/drivers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: out,
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    let msg = "Driver upload failed";
    try {
      const j = JSON.parse(text) as { detail?: string; error?: string };
      msg = j.detail || j.error || msg;
    } catch {
      /* keep fallback */
    }
    return NextResponse.json({ error: msg }, { status: upstream.status === 400 ? 400 : 502, headers: NO_STORE });
  }
  const driver = JSON.parse(text) as { id: string; name: string; owner: string; bytes: number; modifiedAt: string; url: string };
  return NextResponse.json({ ok: true, driver: proxied(driver) }, { status: 201, headers: NO_STORE });
}
