import { NextRequest, NextResponse } from "next/server";

import { validateWdAdmin } from "@/lib/wd-auth";

// Authenticated proxy → DGX stream director (stream-api.tolley.io) for /stream.
// Gate: same as /hq — owner NextAuth session + MFA via validateWdAdmin(). tolley.io holds NO platform stream keys — the
// director on the DGX owns them; this route only forwards commands + status.
const UPSTREAM = process.env.STREAM_API_URL || "https://stream-api.tolley.io";

async function proxy(request: NextRequest, path: string[]) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.STREAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "STREAM_API_KEY not configured" }, { status: 500 });
  }

  const target = `${UPSTREAM}/${path.join("/")}`;
  const init: RequestInit = {
    method: request.method,
    headers: { "x-api-key": key, "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  };
  if (request.method === "POST") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Stream director unreachable — is the DGX online?" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
