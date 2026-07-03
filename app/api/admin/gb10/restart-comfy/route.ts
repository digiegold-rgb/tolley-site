import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

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

  let force = false;
  try {
    const body = await request.json();
    force = Boolean(body?.force);
  } catch {
    // empty body is fine — defaults to non-forced
  }

  try {
    const res = await fetch(`${bridgeUrl()}/restart-comfy`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-GB10-Token": token,
      },
      body: JSON.stringify({ force }),
      cache: "no-store",
      signal: AbortSignal.timeout(80_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
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
