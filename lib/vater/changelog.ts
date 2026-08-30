/**
 * lib/vater/changelog.ts — the single source of truth for "what version of
 * Jelly Studio is this, and what changed in it".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * BUMP RULE (follow it, don't improvise)
 *
 *   MINOR (1.3 → 1.4)  one per SHIPPED user-facing feature. If Trey asked
 *                      for it and a customer can now see or click something
 *                      new, that is a new minor. Several small features that
 *                      ship together share one minor entry.
 *   PATCH (1.3 → 1.3.1) fixes, copy changes, perf, anything a user would
 *                      describe as "it works right now" rather than "there's
 *                      a new thing".
 *
 *   The CHANGELOG entry lands in the SAME COMMIT as the feature. A feature
 *   shipped without its entry is a regression in this file, not a nicety —
 *   the in-app "What's new" panel and GET /api/vater/changelog both read
 *   straight from here, and the unread dot on the header pill keys off
 *   APP_VERSION.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Dates are the SHIP dates, verified against
 *   git log --date=short -- app/animate components/animate lib/vater app/api/vater
 * Newest entry first; the UI renders this array in order.
 */

export const APP_VERSION = '1.18';

export interface ChangelogEntry {
  /** Semver-ish, matches APP_VERSION for the newest entry. */
  version: string;
  /** ISO date (YYYY-MM-DD) the version shipped to production. */
  date: string;
  /** One short line — what this release IS. */
  title: string;
  /** Bullets, customer-readable. No commit hashes, no file paths. */
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.18',
    date: '2026-08-30',
    title: 'Fable generate and header Force Kill, actually live',
    items: [
      'Fable, Opus, and Sonnet write the script instead of thinking the token budget away. An empty or refused write is still not billed.',
      'A red Force Kill sits in the studio header on every video, script, and generation screen once a project is selected. Confirm kills the project and lands you on a fresh Source step.',
    ],
  },
  {
    version: '1.17',
    date: '2026-08-30',
    title: 'Fable generate actually returns a script, and Force Kill sits in the header',
    items: [
      'Fable (and Opus / Sonnet 5) now write the script instead of thinking until the token budget is gone and coming back empty. A failed or empty write is still not billed.',
      'A red Force Kill sits in the studio header on every video, script, and generation screen once a project is selected — Create, Progress, Library, the editors, Script Review, and the rest of the generation chrome. Confirm kills the project and lands you on a fresh Source step.',
    ],
  },
  {
    version: '1.16',
    date: '2026-08-30',
    title: 'Force Kill on Create actually starts you over from step 1',
    items: [
      'A red Force Kill sits at the top of Create, and on Progress when a project is open. It stays visible once a project is loaded — including while the writer is pulsing, when a step failed, or when something needs you.',
      'Confirm and the project is gone. You land on a fresh Source step, not a transcribed lock. You will need to regenerate from step one.',
    ],
  },
  {
    version: '1.15',
    date: '2026-08-30',
    title: 'Script quotes show the final price',
    items: [
      'Script quotes show the final price, no +30% note.',
    ],
  },
  {
    version: '1.14',
    date: '2026-08-30',
    title: 'Script writes never cost less than 5¢, and you can change the length',
    items: [
      'Script generation quotes and charges never go below 5¢. A short Sonnet job is 5¢; a longer Fable job still bills the tokens that were actually used.',
      'On the Writing step, Change length takes you back to the minutes slider so you can pick a different length before you generate. Nothing is charged for going back.',
    ],
  },
  {
    version: '1.13',
    date: '2026-08-29',
    title: 'Pick Fable, Opus or Sonnet — pay what the writer actually used',
    items: [
      'On the Writing step you pick Fable, Opus or Sonnet. Sonnet stays the product default; your last pick is remembered. The script is always editable, with Undo and Redo, and you can generate a new draft from the text in the box — not only from the original video.',
      'Before you generate you see a quoted estimate. After it lands you are billed the actual usage. Quoted vs billed stays on the job. Switching models is a new charge.',
      'A small Stay close / Restructure / Rewrite control sets how far the draft may move from the transcript. Start from your own script or from a video and you land on the same editor — paste, generate, edit, iterate.',
    ],
  },
  {
    version: '1.12',
    date: '2026-08-29',
    title: 'Scripts written by Claude',
    items: [
      'The Writing step now runs on Claude Sonnet 5 and reads your whole transcript, not a summary of it. The script says what your video said, restructured in your voice, with your Script Rules applied — the same workflow you would run by hand in Claude.',
      'Script generation and rewrites are now $0.25 each (was $0.05), shown next to the button before you click.',
    ],
  },
  {
    version: '1.11',
    date: '2026-08-27',
    title: 'Listing Studio — a real-estate front door',
    items: [
      'New at tolley.io/realestateanimated: "Listing Studio by Jelly!" — the same studio, same credits, same login, re-skinned for real-estate agents. Upload one listing photo, pick Virtual Staging ($4.99) or a Before → After Reveal ($29 photoreal / $19 economy), approve the staged still, and get a 1080p video back — usually in 10–15 minutes.',
      'Fair-Housing safe by default: Equal Housing Opportunity on every export, an on-frame "AI-generated - virtually staged" label, your broker name + phone sized to your state\'s rule (MO/KS/PA), a Fair-Housing check on anything you type, an MLS-safe (unlabeled) still for the photo slot, and a public proof page showing the original next to the generated image.',
      'Listing Studio accounts show up in /hq with an origin chip and a license status (Missouri licenses verify live; others go to manual review).',
      'Jelly! Studio itself is unchanged — same colours, same screens, same prices.',
    ],
  },
  {
    version: '1.10',
    date: '2026-08-26',
    title: 'Optional text when your film is ready',
    items: [
      'On Request a seat — and later in Account settings — you can opt in to a text when a film is done, plus studio-account notices. The box is never pre-checked, and you can still request a seat without it.',
      'Reply STOP to cancel, HELP for help. Text START or YES to 913-914-9429, or check the box on Request a seat.',
    ],
  },
  {
    version: '1.9',
    date: '2026-08-26',
    title: 'Portal Hoppers — a free game at tolley.io/game',
    items: [
      'An original co-op pixel platformer: pick Zip, Ember or Moxie, team up with Cubo the cube, hop through ten worlds and free fifteen caged friends — each one adds a power to your Power Wheel.',
      'Cubo plays himself (pillars, boosts, batting candy back at bosses) or a second player drives him with WASD + Shift. Keyboard or touch, chiptune sound, progress saves in your browser.',
    ],
  },
  {
    version: '1.8',
    date: '2026-08-24',
    title: 'Your own script is now the obvious first click',
    items: [
      'Starting a video from a script you already have is a big, unmistakable choice next to Jelly writing it — stacked on a phone, with a real Paste my script button.',
      'Your words are still read verbatim. After you paste, you pick a Style for the voice, same as before.',
    ],
  },
  {
    version: '1.7',
    date: '2026-08-24',
    title: 'Mark videos as posted to YouTube',
    items: [
      'Finished Library videos show a Posted to YouTube badge after you publish in-app, or after you mark them yourself.',
      'Mark or unmark any finished video — useful when you uploaded with VidIQ or YouTube Studio instead of Jelly.',
    ],
  },
  {
    version: '1.6',
    date: '2026-08-23',
    title: 'One live view, deletable projects, honest billing',
    items: [
      'The live render view — phase ladder, the step running now, the rolling worker log — is on the Dashboard and in Project History, not just Script Review. Clicking away no longer loses it.',
      'Project History opens the real detail panel instead of the old progress bars. One view of a render, everywhere.',
      'Projects can be deleted, with a warning that credits already spent on renders are not refunded.',
      'Billing shows what an invoiced account has actually been delivered, paid and owes, instead of an empty credit balance next to a legacy usage figure.',
      'Direct is now Dictate, and a video it starts links straight to its render.',
    ],
  },
  {
    version: '1.5',
    date: '2026-08-23',
    title: 'No length cap, one honest estimate',
    items: [
      'Script length is no longer capped on any plan — the 9:00 beta limit is gone, front to back.',
      'The price you are quoted is now the same number everywhere, and it is quoted conservatively: renders come in under the estimate rather than over it.',
      'A render can no longer be cancelled by anyone who did not start it.',
    ],
  },
  {
    version: '1.4',
    date: '2026-08-22',
    title: 'Your house cast, visible and editable',
    items: [
      'Characters now shows your locked cast — the host and supporting roster every video is built around — with reference portraits.',
      'Any cast member can be edited in place, or cloned and tweaked for a one-off without touching the original.',
      'The style that carries your cast is marked as canon, sorts first, and warns you before a render uses anyone else.',
    ],
  },
  {
    version: '1.3',
    date: '2026-08-15',
    title: 'Role-aware studio + Voice Tuner',
    items: [
      'The sidebar now shows only the screens your account can actually open — no more tabs that answer with a permission error.',
      'Mobile gets a real navigation drawer instead of a sidebar that pushed every screen sideways.',
      'Voice Tuner: per-voice delivery and EQ controls with ~30 second sample renders, and a lock-in that every later render reuses.',
      'Security pass ahead of the invite-only beta — admin sessions expire and can be revoked, and deploy secrets moved out of the cron config.',
      'This changelog, plus in-app feedback straight from the Help panel.',
    ],
  },
  {
    version: '1.2',
    date: '2026-08-13',
    title: 'Course Studio, Direct lane, and honest billing',
    items: [
      'Course Studio: multi-part financial-literacy courses render as one chained job with a shared clip library.',
      'Direct lane — dictate a brief and the studio builds the video without you touching the editor.',
      'Script version history: every generated draft, edit, and approval is kept, so you can always read what changed.',
      'A rolling worker log on Script Review — see the actual step running, not just a spinner.',
      'Rules tab with the current standing spec as a PDF.',
      'Permanent #N numbering in the Library — a video keeps its number forever.',
      'Amount due is now settlement-based: it counts what was delivered since your last payment, not all-time spend minus payments.',
    ],
  },
  {
    version: '1.1',
    date: '2026-08-08',
    title: 'Script Review pipeline + real cost transparency',
    items: [
      'Script Review: an approval gate between a written script and any money spent rendering it.',
      'Publish straight to YouTube from the studio, with title, description, tags, and thumbnail staged in-app.',
      'Studio access tier, so accounts get exactly the surface they paid for.',
      'Finished videos stream from the Blob CDN instead of a per-request proxy — playback stopped stalling.',
      'Per-video cost on every Library card, with a full line-item breakdown behind the number.',
      'Billing shows compute at cost plus render operations as separate lines.',
    ],
  },
  {
    version: '1.0',
    date: '2026-06-11',
    title: 'Pay-per-video launch',
    items: [
      'Jelly Studio opens to customers: card on file, no subscription, billed per action at the price shown next to the button.',
      'Multi-tenant projects — your scripts, voices, styles, and renders belong to your account alone.',
      'Public landing page for signed-out visitors explaining the pipeline end to end.',
    ],
  },
];

/**
 * Numeric compare for the dotted version strings above. Returns a negative
 * number when `a` is older than `b`, 0 when equal, positive when newer.
 * Missing / malformed input sorts as oldest, so an empty localStorage value
 * reads as "has never seen a release" and the unread dot shows.
 */
export function compareVersions(a: string | null | undefined, b: string): number {
  const parse = (v: string | null | undefined): number[] =>
    String(v ?? '')
      .split('.')
      .map((p) => Number.parseInt(p, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const left = parse(a);
  const right = parse(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** localStorage key holding the newest version this browser has read. */
export const LAST_SEEN_VERSION_KEY = 'jelly.lastSeenVersion';
