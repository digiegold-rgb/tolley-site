/**
 * GET /api/vater/voices/elevenlabs → list voices on the authenticated
 * ElevenLabs account, proxied through the autopilot bearer.
 *
 * Returns `{ voices: [...] }` on success, or `{ voices: [], error }` when
 * the autopilot side reports a missing key / failed upstream call. Never 502s
 * on a soft failure — the UI treats empty voices as "fall back to F5 picker".
 */
import { NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";

export async function GET() {
  try {
    const { voices, error } = await autopilot.getElevenLabsVoices();
    return NextResponse.json({ voices, error });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to list ElevenLabs voices",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to list ElevenLabs voices",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
