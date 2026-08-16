/**
 * lib/vater/voice-ids.ts
 *
 * Voice id grammar, shared by client and server. No imports — `voice-privacy.ts`
 * pulls in `@/lib/admin-auth` (and therefore `@/auth`), so a client component
 * can never import it; the parsing half lives here instead so the browser and
 * the route handlers agree on exactly one definition.
 *
 * Per-user namespaces (2026-08-15). Mirrors `content-autopilot/vater.py`:
 *
 *     Monroe             → the shared/system library (bare = shared, always)
 *     u_<userId>~Monroe  → exactly one tenant's clone
 *
 * "~" rather than "/" because the id has to survive a single URL path segment
 * (a Next.js `[id]` route will not match an encoded slash) and a `voiceCloneName`
 * column. The DGX accepts either separator and treats "/" as the canonical
 * logical form, so both round-trip.
 */

/** The shared/system library. Bare voice names live here. */
export const SHARED_VOICE_OWNER = "shared";

/** How many own clones a non-studio account may keep during the beta. */
export const MAX_OWN_VOICES_DEFAULT = 2;

const OWNER_KEY_PATTERN = /^u_[A-Za-z0-9_-]{1,64}$/;

/** Namespace key for a signed-in user. Mirrors `vater.py::sanitize_owner_key`. */
export function ownerKeyForUser(userId: string): string {
  const key = `u_${(userId || "").replace(/[^A-Za-z0-9_-]/g, "")}`;
  return OWNER_KEY_PATTERN.test(key) ? key : SHARED_VOICE_OWNER;
}

/** `"u_abc~Mom"` → `{ owner: "u_abc", stem: "Mom" }`; bare → shared. */
export function splitVoiceId(voiceId: string | null | undefined): {
  owner: string;
  stem: string;
} {
  const raw = (voiceId ?? "").trim();
  let owner = SHARED_VOICE_OWNER;
  let stem = raw;
  for (const sep of ["/", "~"]) {
    const at = raw.indexOf(sep);
    if (at >= 0) {
      owner = raw.slice(0, at);
      stem = raw.slice(at + sep.length);
      break;
    }
  }
  return {
    owner: OWNER_KEY_PATTERN.test(owner) ? owner : SHARED_VOICE_OWNER,
    stem: stem.replace(/[^A-Za-z0-9_-]/g, ""),
  };
}

/** URL-safe id: bare stem when shared, `u_<userId>~Stem` otherwise. */
export function voiceWireId(owner: string, stem: string): string {
  return OWNER_KEY_PATTERN.test(owner) ? `${owner}~${stem}` : stem;
}

/** The part a human should read — never the namespace prefix. */
export function voiceDisplayName(voiceId: string | null | undefined): string {
  return splitVoiceId(voiceId).stem;
}

/** True when the id addresses the shared/system library. */
export function isSharedVoiceId(voiceId: string | null | undefined): boolean {
  return splitVoiceId(voiceId).owner === SHARED_VOICE_OWNER;
}
