import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
import { impactSnapshot, syncImpact } from "@/lib/live/impact";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET() {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await impactSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try { await syncImpact(); return NextResponse.json(await impactSnapshot(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Impact sync did not finish. Previous results are retained; check your Impact connection and retry." }, { status: 502 }); }
}
