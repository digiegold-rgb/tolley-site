/**
 * Shared help copy for Jelly Studio — used by BOTH the public landing page
 * (components/animate/landing/AnimateLanding.tsx) and the in-app Help
 * drawer (components/animate/HelpDrawer.tsx).
 *
 * It lived only in the landing file, which meant a signed-in user had no
 * way to read it. Keep it here so the two never drift.
 *
 * Pricing answers here must match the landing page and the Pricing screen
 * exactly: compute passed through at cost, plus $0.35 per finished minute.
 * There is no subscription and no per-action list price — if you are about
 * to write a different number in this file, fix the number, not the copy.
 */

export interface HelpStep {
  n: string;
  t: string;
  d: string;
}

export const PIPELINE_STEPS: readonly HelpStep[] = [
  {
    n: "01",
    t: "Script",
    d: "Paste the script you already wrote, or generate one from a topic — either way you edit every word.",
  },
  {
    n: "02",
    t: "Voice",
    d: "Cloned and custom voices with word-level caption timing, shaped in the Voice Tuner.",
  },
  {
    n: "03",
    t: "Scenes",
    d: "Every beat becomes a generated cinematic frame, with your characters, in the art style you lock.",
  },
  {
    n: "04",
    t: "Motion",
    d: "Animate the scenes that earn it with Wan2.2 — optional, per scene, priced before you click.",
  },
  {
    n: "05",
    t: "Publish",
    d: "Compose with captions and soundtrack, then publish to YouTube or download the MP4 for any scheduler.",
  },
];

export interface HelpFaq {
  q: string;
  a: string;
}

export const HELP_FAQ: readonly HelpFaq[] = [
  {
    q: "What does a finished video actually cost?",
    a: "The compute your render consumed, passed through at cost, plus $0.35 per finished minute. A typical long-form video lands between $1 and $7 all in — our 8:44 benchmark render cost $5.56. You see the itemised receipt while the render is still running, so there is never a number you find out about later.",
  },
  {
    q: "Is there a subscription?",
    a: "No. There is no plan, no seat fee and no monthly minimum. You buy prepaid credit in $10, $25, $50 or $100 packs and spend it a render at a time. A $10 pack is $9.41 of credit — the difference is Stripe's card processing fee, and we add nothing on top of it. Credit does not expire, and there is nothing to cancel — stop by not rendering.",
  },
  {
    q: "What happens when I put a card on file?",
    a: "Stripe places a $0 verification hold — nothing is charged — and a $10 promotional starter credit lands on your balance. That credit covers the stills pipeline: scripts, transcripts, voice and still scenes. Animated motion runs on purchased credit only, so a fully animated video means buying a pack first. Nothing is billed to the card until you choose to top up.",
  },
  {
    q: "A render failed. Was I charged?",
    a: "No. Failed renders are never charged, partially or otherwise. Retry it from the Queue screen at no cost. And if a render that does succeed overruns its estimate on repair passes, your bill is capped at the estimate — we absorb the difference.",
  },
  {
    q: "How long can a video be?",
    a: "The beta caps a video at 9:00, and defaults to 5:00. That is not arbitrary: renders are proven clean up to just under nine minutes, and the one longer attempt failed quality review. Longer videos are coming once the fix-up budget scales with length.",
  },
  {
    q: "Is there a watermark? Can I download it?",
    a: "No watermark, on anything. You get the finished MP4 to download and use however you like — publish to YouTube from inside the studio, or hand the file to whatever scheduler you already run.",
  },
  {
    q: "Why is the beta invite-only?",
    a: "Because the render fleet is small enough right now that everyone in the beta gets the whole machine, and because feedback from a handful of people who actually ship videos is worth more than a signup graph. Invites go out in small batches — email support@tolley.io and say what you want to make.",
  },
  {
    q: "Whose GPUs is this running on?",
    a: "Rented cloud GPUs (L40S/H100) for the heavy stages, plus metered APIs where they win on quality. Whatever it costs to render your video is what appears on your receipt as compute.",
  },
  {
    q: "Can I generate in other languages?",
    a: "Voiceovers support major languages via F5-TTS and ElevenLabs, and scripts can be generated in any major language.",
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
