import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PATHS = new Set(["/status", "/switch", "/restart-comfy"]);
const ALLOWED_METHODS = new Set(["GET", "POST"]);

function bridgeUrl() {
  return (process.env.GB10_BRIDGE_URL || "https://gb10.tolley.io").replace(
    /\/$/,
    "",
  );
}

export async function POST(request: Request) {
  const sessionResult = await requireAdminApiSession();
  if (!sessionResult.ok) return sessionResult.response;

  const secret = process.env.GB10_BRIDGE_HMAC_SECRET || "";
  if (!secret) {
    return NextResponse.json(
      { error: "GB10_BRIDGE_HMAC_SECRET not configured" },
      { status: 503 },
    );
  }

  let payload: { method?: unknown; path?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const method = String(payload?.method || "").toUpperCase();
  const path = String(payload?.path || "");
  if (!ALLOWED_METHODS.has(method) || !ALLOWED_PATHS.has(path)) {
    return NextResponse.json(
      { error: "invalid method or path" },
      { status: 400 },
    );
  }

  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret)
    .update(`${method}\n${path}\n${ts}`)
    .digest("hex");

  return NextResponse.json(
    {
      url: `${bridgeUrl()}${path}`,
      method,
      ts,
      sig,
      ttl: 120,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
