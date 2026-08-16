/**
 * lib/vater/voice-privacy.ts
 *
 * Owner-private voice clones (Phase 1 beta lockdown, 2026-08-15).
 *
 * The DGX voice library is shared: `autopilot.getVoices()` returns every
 * clone on the box, including Jared's personal trained voices (Jared-A..D,
 * see jared-voice-training). Those are the owner's likeness — a beta
 * customer must never be able to list them, stream their reference WAV, or
 * render narration with them.
 *
 * Predicate lives here (not in voice-catalog.ts, which is editorial UI
 * metadata) so every surface — list, sample stream, tuning, previews —
 * shares one definition.
 *
 * Config: VATER_PRIVATE_VOICES = comma-separated voice names.
 * Default "Jared-A,Jared-B,Jared-C,Jared-D". The /^Jared(-[A-D])?$/i shape
 * is ALWAYS private regardless of env, so a truncated env var can't
 * accidentally expose the owner's voice.
 */
import { isVaterAdminEmail } from "@/lib/admin-auth";

const DEFAULT_PRIVATE_VOICES = "Jared-A,Jared-B,Jared-C,Jared-D";

/** Hard-coded shape that is private no matter what the env says. */
const OWNER_VOICE_PATTERN = /^Jared(-[A-D])?$/i;

function configuredPrivateVoices(): Set<string> {
  const raw = process.env.VATER_PRIVATE_VOICES ?? DEFAULT_PRIVATE_VOICES;
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when this voice name belongs to the owner and must not be exposed. */
export function isPrivateVoiceName(name?: string | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (OWNER_VOICE_PATTERN.test(trimmed)) return true;
  return configuredPrivateVoices().has(trimmed.toLowerCase());
}

/** True when the caller (by session email) may see/use this voice. */
export function canAccessVoice(
  name: string | null | undefined,
  email: string | null | undefined,
): boolean {
  if (!isPrivateVoiceName(name)) return true;
  return isVaterAdminEmail(email);
}

/** Drop owner-private voices from a catalog list for non-owner callers. */
export function filterVoicesForEmail<T extends { name?: string | null }>(
  voices: T[],
  email: string | null | undefined,
): T[] {
  if (isVaterAdminEmail(email)) return voices;
  return voices.filter((v) => !isPrivateVoiceName(v?.name));
}
