/**
 * lib/wd/voice.ts — re-export of the canonical Jared voice module.
 * Kept so existing WD imports stay stable; the source of truth moved to
 * lib/jared-voice.ts when the voice went platform-wide (2026-06-11).
 */

export { JARED_SMS_VOICE, JARED_EMAIL_VOICE, jaredGreeting } from "@/lib/jared-voice";
