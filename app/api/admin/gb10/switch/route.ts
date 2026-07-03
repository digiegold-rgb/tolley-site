import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED_MODES = new Set(["qwen36", "creator", "draft"]);

function bridgeUrl() {
  return (process.env.GB10_BRIDGE_URL || "https://gb10.tolley.io").replace(
    /\/$/,
    "",
  );
}

export async function POST(request: Request) {
  const sessionResult = await requireAdminApiSession();
  if (!sessionResult.ok) return sessionResult.response;

  const token = process.env.GB10_BRIDGE_TOKEN || "";
  if (!token) {
    return NextResponse.json(
      { error: "GB10_BRIDGE_TOKEN not configured" },
      { status: 503 },
    );
  }

  let payload: { mode?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const mode = String(payload?.mode || "").trim();
  if (!ALLOWED_MODES.has(mode)) {
    return NextResponse.json(
      { error: "invalid mode", allowed: [...ALLOWED_MODES] },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${bridgeUrl()}/switch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-GB10-Token": token,
      },
      body: JSON.stringify({ mode }),
      cache: "no-store",
      signal: AbortSignal.timeout(290_000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "bridge_unreachable", detail: String(err) },
      { status: 502 },
    );
  }
}
