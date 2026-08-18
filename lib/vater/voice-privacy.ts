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
 *
 * ─── Per-user namespaces (Phase 3, 2026-08-15) ─────────────────────────────
 *
 * The private-name predicate above protects the owner's four clones. It does
 * nothing for customers uploading their own voice, which the beta now allows:
 * two tenants can both name a clone "Mom" and neither may hear the other's.
 *
 * So a voice id is owner-scoped, matching `vater.py`:
 *
 *     Monroe             → the shared/system library (bare = shared, forever)
 *     u_<userId>~Monroe  → exactly one tenant's clone
 *
 * "~" rather than "/" because the id has to survive a single URL path segment
 * (a Next.js `[id]` route will not match an encoded slash). The DGX accepts
 * either separator; "/" is the canonical logical form and both round-trip.
 */
import { isVaterAdminEmail } from "@/lib/admin-auth";
import {
  SHARED_VOICE_OWNER,
  ownerKeyForUser,
  splitVoiceId,
} from "./voice-ids";

const DEFAULT_PRIVATE_VOICES = "Jared-A,Jared-B,Jared-C,Jared-D";

/** Hard-coded shape that is private no matter what the env says. */
const OWNER_VOICE_PATTERN = /^Jared(-[A-D])?$/i;

/**
 * Shared-library entries that are not narration options at all.
 *
 * `Sample` is the voice-cloning smoke test — its reference audio is literally
 * "This is a test of the voice cloning system" — and until 2026-08-17 it sat
 * in the customer picker between Rae and Sterling as if it were a voice you
 * could ship a video with.
 *
 * Kept separate from the private list on purpose: private is a TENANCY rule
 * (whose voice is this), this is a CATALOG rule (is this a product). The
 * internal x-sync-secret path deliberately still sees it so harnesses can
 * keep using it.
 */
const NON_PRODUCT_VOICE_PATTERN = /^Sample$/i;

/** True when this shared voice is a test fixture rather than a real option. */
export function isNonProductVoiceName(name?: string | null): boolean {
  return NON_PRODUCT_VOICE_PATTERN.test((name ?? "").trim());
}

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
  return voices.filter(
    (v) => !isPrivateVoiceName(v?.name) && !isNonProductVoiceName(v?.name),
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Per-user voice namespaces
// ───────────────────────────────────────────────────────────────────────────
//
// The id grammar itself lives in `voice-ids.ts` so client components can use
// it too — this module cannot be imported from the browser (admin-auth →
// @/auth). Re-exported here so server callers only need one import.

export {
  SHARED_VOICE_OWNER,
  MAX_OWN_VOICES_DEFAULT,
  ownerKeyForUser,
  splitVoiceId,
  voiceWireId,
  voiceDisplayName,
  isSharedVoiceId,
} from "./voice-ids";

/** True when this id addresses the caller's own namespace. */
export function ownsVoice(
  voiceId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return splitVoiceId(voiceId).owner === ownerKeyForUser(userId);
}

/**
 * May this caller READ / render with this voice?
 *
 * Shared voices: yes, minus the owner-private clones. Namespaced voices: only
 * their owner (and the owner account, which sees everything).
 */
export function canReadVoice(
  voiceId: string | null | undefined,
  caller: { userId?: string | null; email?: string | null },
): boolean {
  if (isVaterAdminEmail(caller.email)) return true;
  const { owner, stem } = splitVoiceId(voiceId);
  if (owner !== SHARED_VOICE_OWNER) return ownsVoice(voiceId, caller.userId);
  return !isPrivateVoiceName(stem) && !isNonProductVoiceName(stem);
}

/**
 * May this caller WRITE (delete, re-tune, re-sample) this voice?
 *
 * Strictly narrower than reading: the shared library is read-only for everyone
 * but the owner, so no tenant can delete Monroe or re-EQ her for the whole beta.
 */
export function canWriteVoice(
  voiceId: string | null | undefined,
  caller: { userId?: string | null; email?: string | null },
): boolean {
  if (isVaterAdminEmail(caller.email)) return true;
  return ownsVoice(voiceId, caller.userId);
}

/** Catalog filter for a signed-in caller: shared (minus private) + own. */
export function filterVoicesForCaller<T extends { name?: string | null }>(
  voices: T[],
  caller: { userId?: string | null; email?: string | null },
): T[] {
  if (isVaterAdminEmail(caller.email)) return voices;
  return voices.filter((v) => canReadVoice(v?.name, caller));
}
