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

export const APP_VERSION = '1.7';

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
