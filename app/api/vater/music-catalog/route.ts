/**
 * GET /api/vater/music-catalog
 *
 * Proxies the DGX `/vater/music-catalog` endpoint. Returns the full
 * CC-BY-4.0 Kevin MacLeod background-music library so the frontend can
 * build a picker for the YouTube project context form.
 *
 * Surface errors directly per `feedback_silent_failures_leads.md`.
 */
import { NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";

export async function GET() {
  try {
    const tracks = await autopilot.fetchMusicCatalog();
    return NextResponse.json({ tracks });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to load music catalog",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to load music catalog",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
