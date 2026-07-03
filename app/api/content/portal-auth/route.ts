import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

/**
 * GET /api/content/portal-auth
 * Returns the SYNC_SECRET to authenticated admin users,
 * so the portal frontend can call existing /api/content/* routes.
 */
export async function GET() {
  const result = await requireAdminApiSession();
  if (!result.ok) return result.response;

  return NextResponse.json({
    key: process.env.SYNC_SECRET || "",
    autopilotKey: "autopilot-portal-2026",
    autopilotUrl: "https://content-api.tolley.io",
    autopilotTailscale: "http://100.81.82.79:8096",
  });
}
