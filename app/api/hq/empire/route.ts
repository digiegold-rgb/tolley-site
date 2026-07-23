import { NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
import { getEmpirePayload } from "@/lib/empire-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/hq/empire — full Empire Map health payload (PIN auth). */
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getEmpirePayload());
}
