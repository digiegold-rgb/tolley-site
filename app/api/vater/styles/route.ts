/**
 * GET /api/vater/styles
 *
 * Thin proxy to the autopilot `/vater/styles` endpoint. The 8 style presets
 * are also defined locally in `lib/vater/style-presets.ts` (which is the
 * source of truth for prompts + sample imagery). This proxy exists so the
 * UI can confirm the DGX side reports the same set, surfacing schema drift.
 */
import { NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";

export async function GET() {
  try {
    const styles = await autopilot.getStyles();
    return NextResponse.json({ styles });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to list styles",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to list styles",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
