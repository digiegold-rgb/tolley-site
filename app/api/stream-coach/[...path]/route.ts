import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

export const dynamic = "force-dynamic";
const paths: Record<string, string> = { snapshot: "GET", action: "POST", ask: "POST" };
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Sign in with your owner account." }, { status: 401 });
  const { path } = await context.params;
  if (path.length !== 1 || paths[path[0]] !== request.method) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Use the incoming Host: Next dev may normalize nextUrl to localhost even for a 127.0.0.1 browser.
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
  if (request.method === "POST" && request.headers.get("origin") && request.headers.get("origin") !== origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const key = process.env.STREAM_API_KEY;
  if (!key) return NextResponse.json({ error: "Stream connection is not configured." }, { status: 503 });
  const query = new URLSearchParams();
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (sessionId) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) return NextResponse.json({ error: "Invalid show" }, { status: 400 });
    query.set("sessionId", sessionId);
  }
  const body = request.method === "POST" ? await request.text() : undefined;
  if (body && new TextEncoder().encode(body).length > 12000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  try {
    const response = await fetch(`${process.env.STREAM_API_URL || "https://stream-api.tolley.io"}/coach/${path[0]}?${query}`, {
      method: request.method, body, headers: { "x-api-key": key, "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const json = await response.json();
    return NextResponse.json(json, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Stream Coach is unreachable. Your saved shows remain on the stream computer." }, { status: 502 }); }
}
export const GET = proxy;
export const POST = proxy;
