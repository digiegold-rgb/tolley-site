import { NextRequest, NextResponse } from "next/server";

import { validateShopAdmin } from "@/lib/shop-auth";

// Authenticated proxy → DGX tv-api (tv-api.tolley.io) for the /tv Live & DVR tab.
// Gate: same shop-admin PIN cookie that unlocks the /tv page itself.
const UPSTREAM = process.env.TV_API_URL || "https://tv-dvr.tolley.io";

async function proxy(request: NextRequest, path: string[]) {
  const authed = await validateShopAdmin();
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.TV_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "TV_API_KEY not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const target = `${UPSTREAM}/api/${path.join("/")}${url.search}`;
  const init: RequestInit = {
    method: request.method,
    headers: { "x-api-key": key, "content-type": "application/json" },
    // avoid Vercel caching live guide data
    cache: "no-store",
  };
  if (request.method === "POST") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "TV service unreachable — is the DGX online?" },
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
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
