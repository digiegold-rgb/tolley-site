/**
 * lib/vater/voice-preview-access.ts
 *
 * Voice Tuner previews are addressed by an opaque previewId, so the
 * owner-private-voice check (lib/vater/voice-privacy.ts) can't run off the
 * URL alone — we have to ask the DGX which voice the preview belongs to.
 *
 * Returns a 403/404 NextResponse when the caller may not touch this preview,
 * or null when it's allowed. No session = x-sync-secret server-to-server
 * caller, which is already fully trusted.
 */
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot } from "@/lib/vater/autopilot-client";
import { canAccessVoice } from "@/lib/vater/voice-privacy";

export async function denyPrivateVoicePreview(
  previewId: string,
): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const email = session.user.email ?? null;
  let voice: string | undefined;
  try {
    voice = (await autopilot.getVoicePreview(previewId))?.voice;
  } catch {
    // Upstream lookup failed — let the caller's own upstream call surface it.
    return null;
  }
  if (canAccessVoice(voice, email)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
