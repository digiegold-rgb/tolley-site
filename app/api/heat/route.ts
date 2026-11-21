import { NextResponse } from "next/server";
import { validateHeatAccess } from "@/lib/heat/auth";
import { ensureLoftFanColumns } from "@/lib/heat/ensure-columns";
import { loadHeatView } from "@/lib/heat/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureLoftFanColumns();
  } catch (error) {
    console.error("[heat] loft fan columns", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Heat storage is unavailable" }, { status: 503 });
  }
  if (!(await validateHeatAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await loadHeatView(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[heat] read failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Heat storage is unavailable" }, { status: 503 });
  }
}
