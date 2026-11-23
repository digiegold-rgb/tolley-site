import { NextRequest, NextResponse } from "next/server";
import { heatIngestAuthorized } from "@/lib/heat/auth";
import { parseHeatBody } from "@/lib/heat/parse";
import { saveHeatIngest } from "@/lib/heat/store";
import { rateLimitByIp } from "@/lib/rate-limit";
import { parsePlannerEvents } from "@/lib/heat/planner-schema";
import { savePlannerEvents } from "@/lib/heat/planner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY = 1_500_000;

export async function POST(request: NextRequest) {
  if (!heatIngestAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const limited = await rateLimitByIp(request, "heat:ingest", 120, 3600);
    if (limited) return limited;
  } catch {
    console.error("[heat] ingest rate limit skipped");
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (json && typeof json === "object" && "events" in json) {
    let events;
    try { events = parsePlannerEvents((json as { events: unknown }).events); }
    catch { return NextResponse.json({ error: "Invalid planner events" }, { status: 400 }); }
    try { return NextResponse.json({ ok: true, ...await savePlannerEvents(events) }); }
    catch { return NextResponse.json({ error: "Planner storage unavailable" }, { status: 503 }); }
  }
  const parsed = parseHeatBody(json);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.batch.snapshots.length && !parsed.batch.days.length && !parsed.batch.reviews.length) {
    return NextResponse.json({ error: "Nothing to store" }, { status: 400 });
  }
  try {
    const saved = await saveHeatIngest(parsed.batch);
    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    console.error("[heat] ingest failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Heat storage is unavailable" }, { status: 503 });
  }
}
