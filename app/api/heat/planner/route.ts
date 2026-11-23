import { NextResponse } from "next/server";
import { validateHeatAccess } from "@/lib/heat/auth";
import { loadPlannerView } from "@/lib/heat/planner-store";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!await validateHeatAccess()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await loadPlannerView(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Planner storage unavailable" }, { status: 503 }); }
}
