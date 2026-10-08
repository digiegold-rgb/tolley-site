import { NextRequest, NextResponse } from "next/server";
import { shopVideoGate } from "@/lib/shop-video/auth";
import { act, report } from "@/lib/content-income/store";
import { safeError } from "@/lib/content-income/core";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET() {
  const denied = await shopVideoGate(); if (denied) return denied;
  try { return NextResponse.json(await report(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Content income reporting is unavailable. Check the database migration and connection." }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const denied = await shopVideoGate(req); if (denied) return denied;
  const expected = new URL(req.nextUrl.origin); expected.host = req.headers.get("host") || expected.host;
  if (req.headers.get("origin") !== expected.origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  try { const data = await req.json(); await act(data); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: safeError(e) }, { status: 400 }); }
}
