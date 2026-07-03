/**
 * GET /api/vater/pipeline-status
 *
 * Thin proxy to the autopilot `/vater/pipeline-status` endpoint. Returns a
 * live snapshot of both ComfyUI instances (interactive :8188 and Vater
 * :8189) plus any currently-running Vater jobs. Polled by the /vater/youtube
 * page every ~3s so the user sees GPU + queue progress without SSH.
 */
import { NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const status = await autopilot.getPipelineStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to fetch pipeline status",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to fetch pipeline status",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
