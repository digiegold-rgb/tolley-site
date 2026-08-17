import "server-only";
import { autopilot } from "./autopilot-client";

/**
 * Pre-flight for renders that narrate on ElevenLabs (2026-08-17).
 *
 * ElevenLabs is bring-your-own-key: each tenant connects their own account in
 * Jelly Studio → Voices, and the render box refuses to spend anyone else's
 * characters. Without this check the refusal happens at the TTS step —
 * *after* the script and images have been paid for — so the kickoff routes
 * ask first and fail for free.
 *
 * Fails OPEN on a transport error. The DGX is the authority on whether a key
 * exists; if we cannot reach it to ask, blocking a render on a network blip
 * would be inventing an outage the render itself might not have.
 */
export async function elevenLabsKeyMissing(
  ownerId: string | null | undefined,
): Promise<boolean> {
  const owner = (ownerId || "").trim();
  // No tenant at all = owner-side tooling, which uses the box's own key.
  if (!owner) return false;
  try {
    const status = await autopilot.getUserProviderKey("elevenlabs", owner);
    return !status.configured && !status.houseKey;
  } catch {
    return false;
  }
}

/** The one message both kickoff paths show, so the fix reads the same way. */
export const ELEVENLABS_KEY_REQUIRED =
  "This project narrates with an ElevenLabs voice, but your ElevenLabs account " +
  "is not connected. Open Voices → ElevenLabs and paste your own API key " +
  "(elevenlabs.io → profile → API Keys), or pick one of your own voice clones " +
  "instead — those are free and need no key.";
