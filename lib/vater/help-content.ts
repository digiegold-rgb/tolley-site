/**
 * Shared help copy for Jelly Studio — used by BOTH the public landing page
 * (components/animate/landing/AnimateLanding.tsx) and the in-app Help
 * drawer (components/animate/HelpDrawer.tsx).
 *
 * It lived only in the landing file, which meant a signed-in user had no
 * way to read it. Keep it here so the two never drift.
 *
 * Free-tier numbers come from VATER_TRIAL_CAPS — do not hardcode them.
 */

import { VATER_TRIAL_CAPS } from "@/lib/vater-subscription";

export interface HelpStep {
  n: string;
  t: string;
  d: string;
}

export const PIPELINE_STEPS: readonly HelpStep[] = [
  {
    n: "01",
    t: "Script",
    d: "Type a topic — or paste a transcript. The script writes itself, you edit every word.",
  },
  {
    n: "02",
    t: "Voice",
    d: "Cloned voices with word-level caption timing. Bring your own or pick from the library.",
  },
  {
    n: "03",
    t: "Scenes",
    d: "Every beat becomes a cinematic frame, in the art style you lock for the whole channel.",
  },
  {
    n: "04",
    t: "Motion",
    d: "Animate any scene with Wan2.2, Hunyuan, Kling, Veo or Luma — per-scene, your call.",
  },
  {
    n: "05",
    t: "Publish",
    d: "Compose with soundtrack + captions, then push to YouTube, TikTok, IG, Facebook, Pinterest.",
  },
];

export interface HelpFaq {
  q: string;
  a: string;
}

export const HELP_FAQ: readonly HelpFaq[] = [
  {
    q: "How does billing work?",
    a: "You put a card on file — there is no subscription and no monthly fee. Each action bills at the fixed price shown next to the button, charges accrue on your account, and your card is invoiced automatically once they reach $25 (plus a monthly sweep for anything left over). Failed renders are never charged.",
  },
  {
    q: "What is included for free?",
    a: `Every account starts with ${VATER_TRIAL_CAPS.transcripts} transcripts, ${VATER_TRIAL_CAPS.scenes} scene generation and ${VATER_TRIAL_CAPS.animations} animation — no card required and no time limit. It ends when you hit a cap, not a date. A full video needs more scenes than the free allowance, so add a card when you are ready to finish one.`,
  },
  {
    q: "What does a finished video actually cost?",
    a: "A typical 15-scene video — script, voiceover, scene images, a few animated clips and the final compose — lands around $25. You see the exact price next to every button before you click it, and a per-render confirm for batch animation.",
  },
  {
    q: "Whose GPUs is this running on?",
    a: "A hybrid stack: budget tiers render on our own hardware, premium tiers spin up dedicated cloud GPUs (L40S/H100) or metered APIs like Veo and Kling. You pick the tier per scene — the dropdown shows price and ETA for each.",
  },
  {
    q: "Can I generate in other languages?",
    a: "Voiceovers support major languages via F5-TTS and ElevenLabs, and scripts can be generated in any major language.",
  },
  {
    q: "A render failed. Was I charged?",
    a: "No. Only completed actions bill. If a job fails you can retry it from the Queue screen at no extra cost.",
  },
];

/** Support inbox surfaced in the Help drawer.
 *
 * The in-app feedback form (POST /api/vater/feedback) is the PRIMARY channel —
 * it files a ticket on the /hq queue and pings Telegram, so nothing gets lost
 * in a mailbox. This address is the secondary path for people who would
 * rather write an email, and for signed-out visitors on the landing page.
 */
export const HELP_SUPPORT_EMAIL = "support@tolley.io";
