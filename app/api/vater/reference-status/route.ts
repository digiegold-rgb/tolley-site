/**
 * GET /api/vater/reference-status
 *
 * Thin proxy to the autopilot `/vater/reference-status` endpoint. Returns
 * a map of style-preset → { hasReference, ipaWeight, weightType, endAt }
 * so the style picker can badge presets that have a curated reference.png
 * dropped into /home/jelly/Shared/reference-library/<preset>/.
 */
import { NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";

export async function GET() {
  try {
    const references = await autopilot.getReferenceStatus();
    return NextResponse.json({ references });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to fetch reference status",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to fetch reference status",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
