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
  // Coach requests use the dedicated proxy with its method, size and origin checks.
  if (path[0] === "coach") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.method === "POST") {
    // Next can normalize nextUrl to localhost behind a proxy. Compare the
    // browser Origin with the actual HTTP Host, not that internal URL.
    let sameOrigin = false;
    try {
      const origin = new URL(request.headers.get("origin") || "");
      sameOrigin = origin.host === request.headers.get("host") &&
        (origin.protocol === "https:" || (process.env.NODE_ENV !== "production" && origin.protocol === "http:"));
    } catch { /* missing/invalid Origin */ }
    if (!sameOrigin) return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > 8192) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  const key = process.env.STREAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "STREAM_API_KEY not configured" }, { status: 500 });
  }

  // Keep the query string (chat polls with ?since=&limit=; thumbnails cache-bust with ?t=).
  const target = `${UPSTREAM}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const init: RequestInit = {
    method: request.method,
    headers: { "x-api-key": key, "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(path[0] === "facebook" ? 60_000 : 12_000),
  };
  if (request.method === "POST") {
    init.body = await request.text();
    if (new TextEncoder().encode(init.body).length > 8192) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  try {
    const upstream = await fetch(target, init);
    // Bytes, not text: /thumb/*.jpg is binary. Upstream content-type passes straight through.
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
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
