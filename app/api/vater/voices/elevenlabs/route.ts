/**
 * GET /api/vater/voices/elevenlabs → list voices on the CALLER'S OWN
 * ElevenLabs account, proxied through the autopilot bearer.
 *
 * Scoped to the session user since 2026-08-17: each tenant connects their own
 * ElevenLabs key (see /api/vater/me/elevenlabs-key), so the picker must show
 * that account's voices — showing the box's would offer voices the render
 * would then be refused. A caller with no session user (the x-sync-secret
 * agent path) gets the owner-side listing, which is the old behaviour.
 *
 * Returns `{ voices: [...] }` on success, or `{ voices: [], error }` when
 * the autopilot side reports a missing key / failed upstream call. Never 502s
 * on a soft failure — the UI treats empty voices as "fall back to F5 picker".
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import { requireVaterProxyRead } from "@/lib/vater/proxy-auth";

export async function GET(req: Request) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  try {
    const session = await auth();
    const { voices, error, keySource } = await autopilot.getElevenLabsVoices(
      session?.user?.id ?? undefined,
    );
    return NextResponse.json({ voices, error, keySource });
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
