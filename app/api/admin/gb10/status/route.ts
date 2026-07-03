import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bridgeUrl() {
  return (process.env.GB10_BRIDGE_URL || "https://gb10.tolley.io").replace(
    /\/$/,
    "",
  );
}

export async function GET() {
  const sessionResult = await requireAdminApiSession();
  if (!sessionResult.ok) return sessionResult.response;

  const token = process.env.GB10_BRIDGE_TOKEN || "";
  if (!token) {
    return NextResponse.json(
      { error: "GB10_BRIDGE_TOKEN not configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${bridgeUrl()}/status`, {
      headers: { "X-GB10-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
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
