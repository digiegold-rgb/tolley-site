/**
 * GET /api/vater/sfx-catalog
 *
 * Proxies the DGX `/vater/sfx-catalog` endpoint. Returns the full CC0
 * procedural SFX library for the frontend picker. Per-scene injection is
 * a v2 feature — for now this endpoint only exposes the catalog.
 *
 * Surface errors directly per `feedback_silent_failures_leads.md`.
 */
import { NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import { requireVaterProxyAuth } from "@/lib/vater/proxy-auth";

export async function GET(req: Request) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  try {
    const sfx = await autopilot.fetchSfxCatalog();
    return NextResponse.json({ sfx });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to load SFX catalog",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to load SFX catalog",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
