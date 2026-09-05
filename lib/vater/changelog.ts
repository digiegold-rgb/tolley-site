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

export const APP_VERSION = '1.31.1';

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
    version: '1.31.1',
    date: '2026-09-05',
    title: 'Generate Motion deploys again',
    items: [
      'The Motion clip player, slow-mo, and beat stitch can ship. Their time limits live on the routes, not in the shared functions list that was already full.',
    ],
  },
  {
    version: '1.31',
    date: '2026-09-05',
    title: 'Generate stills get Location, Hair, and Camera chips',
    items: [
      'On Modal stills, one-tap chips rewrite setting, hair, and camera in the prompt so you do not have to edit the whole card.',
      'Clear drops that section. Face still follows the identity photos. Wardrobe still needs Extra image #1 when you want a clothes keep-still.',
    ],
  },
  {
    version: '1.30.1',
    date: '2026-09-05',
    title: 'Generate stills stay off the public web',
    items: [
      'Modal stills on Generate are no longer posted as a public web link. Sign in at HQ and they still show in the gallery.',
      'Identity reference photos may still use the old public link for now.',
    ],
  },
  {
    version: '1.30',
    date: '2026-09-05',
    title: 'Generate Motion turns a keep still into a short identity-locked clip',
    items: [
      'A Motion tab on Generate takes a Modal still URL, a pasted Blob URL, or an upload and runs fal Wan image-to-video — the still is the first frame, about five seconds.',
      'An optional last-frame still (another photo, not a skeleton video) uses Wan first-to-last-frame. Face-lock follow-up (LatentSync) and beat stitch are not in this release.',
      'Same Jared/admin gate as Modal stills. Dry run still spends nothing. Adult Lady / Lady2 clips stay allowed; CSAM and minors stay refused.',
    ],
  },
  {
    version: '1.29',
    date: '2026-09-05',
    title: 'Allow NSFW now rewrites Modal still wardrobe, not only the negative',
    items: [
      'On Modal stills, Allow NSFW strips adult NSFW-block terms and adds a wardrobe override so grey-shirt identity refs no longer lock clothes.',
      'Block NSFW puts those terms back and removes the override. Child and minor stay in the negative. A lingerie or nude keep-still can go in extra image URLs.',
    ],
  },
  {
    version: '1.28',
    date: '2026-09-05',
    title: 'Generate Modal stills get Allow NSFW / Block NSFW chips',
    items: [
      'On Modal stills, two chips next to Negative prompt merge or strip adult NSFW-block terms without wiping identity or quality negatives.',
      'Child and minor stay in the negative if they were already there. Chat can still write the negative prompt freely.',
    ],
  },
  {
    version: '1.27.1',
    date: '2026-09-05',
    title: 'Generate stills save again after the extra Diffusers knobs',
    items: [
      'Confirm/Go can persist a job card again. The extra Diffusers knobs (attention and the free-form pipe bag) are stored as plain JSON.',
      'Still headless Diffusers kwargs only — no Comfy nodes, no denoise/strength, no tokens or Spark paths.',
    ],
  },
  {
    version: '1.27',
    date: '2026-09-05',
    title: 'Generate Modal stills type every Diffusers creative kwarg',
    items: [
      'The job card now types attention_kwargs and still accepts pipe_overrides (or modal_kwargs) for any future pipe arg.',
      'Denoise/strength, Spark paths, and tokens are stripped. This recipe still has no Comfy nodes.',
    ],
  },
  {
    version: '1.26',
    date: '2026-09-05',
    title: 'Generate Modal stills get a pipe_overrides escape hatch',
    items: [
      'Advanced JSON and chat can set pipe_overrides — a free-form bag of extra Diffusers pipe() kwargs for rare args the typed card does not cover.',
      'Secrets, tokens, and Spark filesystem paths are stripped before Modal. Unknown override keys raise a clear worker error. Still no Comfy nodes or denoise/strength.',
    ],
  },
  {
    version: '1.25',
    date: '2026-09-05',
    title: 'Generate Modal stills get more Diffusers knobs',
    items: [
      'Modal stills now expose max sequence length, up to three extra HTTPS edit/style image URLs, and optional sigmas — still headless kwargs, not Comfy nodes.',
      'CFG is labeled as true_cfg_scale (the CFG that matters on this recipe). Guidance stays at 1. There is no denoise/strength — use steps, CFG, and the negative prompt.',
    ],
  },
  {
    version: '1.24.4',
    date: '2026-09-02',
    title: 'Tolley TV Analytics splits stuck vs moving processing',
    items: [
      'Processing and waiting titles now show how long they have been in that state, like “in queue 3h 12m”.',
      'The old single processing number is split into moving (bytes or time left) and stuck (idle for two hours, or import pending / blocked).',
      'A built-in watcher retries FAILED Overseerr requests only — that button re-approves and re-sends to Arr; it does not restart Transmission. Stalled downloads retry through tv-stats. Import-blocked titles are left alone.',
      'A read-only NAS snapshot (tv-stats) fills the storage bar and live peers / percent when it is up. If it is down, Overseerr lists still load.',
      'Search, request, and Live & DVR are still untouched. No Arr / Transmission / Plex keys on this site.',
    ],
  },
  {
    version: '1.24.3',
    date: '2026-09-02',
    title: 'Tolley TV Analytics shows downloads without touching requests',
    items: [
      'A last Analytics tab on Tolley TV lists Overseerr processing, failed, and available titles, with 4K vs HD on movies.',
      'Search, browse, request, and Live & DVR are unchanged. Queue and disk stay on the NAS — this tab does not take Arr, Transmission, or Plex keys.',
    ],
  },
  {
    version: '1.24.2',
    date: '2026-09-01',
    title: 'Socials keeps up when you switch studios',
    items: [
      'Switching studios keeps you on the screen you were on — compare Socials (or Library) across studios one click per tab, instead of landing back on the Dashboard every time.',
      'Video tiles no longer paint a black square: the resting frame now sits past the fade-in, so a full library looks full.',
      'Listing Studio reels now show up on Socials with their staged still, and the make-a-video button there opens the listing wizard.',
      'A clip our house channels already posted now reads "Live on" that channel instead of "Ready — post this".',
    ],
  },
  {
    version: '1.24.1',
    date: '2026-09-01',
    title: 'Socials and Library stay snappy with a lot of finished videos',
    items: [
      'Socials paints the studio name and tiles right away from a light list — performance numbers fill in after. Opening the tab no longer waits on every clip.',
      'Small thumbs use a still when we have one. If the only file is the finished video, we load that file only for tiles you can see, a few at a time.',
      'Tap a Socials tile and Library opens that video immediately. The rest of the grid loads in the background and stays lazy off-screen.',
    ],
  },
  {
    version: '1.24',
    date: '2026-09-01',
    title: 'Socials is per studio; the house dump lives on the dashboard',
    items: [
      'The main dashboard is where you see everything that is live — house HQ numbers for the owner login, and every studio’s active videos for everyone else.',
      'Socials now follows the studio tab you are on. Ruthann shows Ruthann. Estate shows Estate. Empty Zernio no longer blanks the page — you still get this studio’s video thumbs and a push to make another.',
      'Winning clips pulse. Tiles reuse the Library first-frame preview. Tap a tile to open it in Library.',
    ],
  },
  {
    version: '1.23.1',
    date: '2026-09-01',
    title: 'Library cards show a real frame before you hover',
    items: [
      'A finished video in Library shows a frame from the mp4 even when it has no thumbnail yet.',
      'Hover still plays a silent preview. We did not generate a thumbnail file for every imported clip.',
    ],
  },
  {
    version: '1.23',
    date: '2026-08-31',
    title: 'Owner Socials shows house posts, and each studio tab keeps its own library',
    items: [
      'If you are the house login, Socials now shows the same HQ Posts numbers — DGX, ads Day $ / Life $, the view counter, every video, and channel health — without connecting Zernio or opening extra studio tabs.',
      'Switching studio tabs keeps Socials and Library on that tab. An empty Ruthann, Estate, or Housing library is correct until those videos are imported.',
      'Studio and beta accounts still see only their own socials. They never see house ads or the view counter.',
    ],
  },
  {
    version: '1.22.3',
    date: '2026-08-30',
    title: 'Public beta signup — no invite code on the ad path',
    items: [
      'Create an account from Roll camera or a credit pack with no invite code. Public beta, $10 starter credit on a card on file, no subscription.',
      'Sign-in and sign-up page titles say Jelly Studio · Tolley.io, not t-agent.',
      'The pricing calculator and landing copy match the real beta length: default 5:00, cap 9:00.',
    ],
  },
  {
    version: '1.22.2',
    date: '2026-08-30',
    title: 'Approve & Animate actually starts the render',
    items: [
      'Approving a script in Script Review starts the priced render (Jelly or Fable 5) instead of parking with nothing queued.',
      'A render that has a job is no longer stuck on “script ready” after Spark finishes — the studio keeps polling until the file is ready.',
      'Own-script videos keep the Jeff/Linda look and voice, and opening motion uses Narrative pricing, not Action.',
    ],
  },
  {
    version: '1.22.1',
    date: '2026-08-30',
    title: 'Finished videos show in Library without a human deliver click',
    items: [
      'When the stitch finishes and the final mp4 is live, the video is Ready in your Library — even if Fable 5 is still in QA or the audit file is missing.',
      'A finished file can no longer sit in Moving Now after the studio has already sewn it. Opening Library or the project flips any row that got stuck.',
    ],
  },
  {
    version: '1.22',
    date: '2026-08-30',
    title: 'Fable generate gets five minutes, and production can actually deploy',
    items: [
      'Generate from the video and Talk to Claude can run up to five minutes, so a long Fable write is not cut off at 60 seconds.',
      'If the writer still runs too long, you see that nothing was billed and you can click generate again — not a raw HTTP 504.',
      'Script writes now go through the studio AI Gateway. What you pay is still the published Claude rates plus 30%, never under 5¢.',
      'Production can deploy again. The five-minute window lives on the routes themselves so we stay under Vercel’s 50-function config cap.',
    ],
  },
  {
    version: '1.21',
    date: '2026-08-30',
    title: 'Fable generate gets five minutes, and the writer goes through AI Gateway',
    items: [
      'Generate from the video and Talk to Claude can run up to five minutes, so a long Fable write is not cut off at 60 seconds.',
      'If the writer still runs too long, you see that nothing was billed and you can click generate again — not a raw HTTP 504.',
      'Script writes now go through the studio AI Gateway. What you pay is still the published Claude rates plus 30%, never under 5¢.',
    ],
  },
  {
    version: '1.20',
    date: '2026-08-30',
    title: 'Talk to Claude on Review, Script on Current due, and Standard deploys finish',
    items: [
      'On Review script you can Talk to Claude about the draft in the box. Each send is quoted first and billed after, on the same Fable / Opus / Sonnet picker. Editing the box stays free. If Claude returns a full revised narration, Apply to editor is free and goes through Undo / History.',
      'Current due now includes unpaid script-writer charges the moment they land — generate and Talk — with a Script line on the since-last-payment card. The header pill updates without a reload.',
      'Production builds finish on the Standard 8 GB machine. The Review and Talk screens no longer tip the collect-page-data step over memory.',
    ],
  },
  {
    version: '1.19',
    date: '2026-08-30',
    title: 'Talk to Claude on Review, and script charges on Current due',
    items: [
      'On Review script you can Talk to Claude about the draft in the box. Each send is quoted first and billed after, on the same Fable / Opus / Sonnet picker. Editing the box stays free. If Claude returns a full revised narration, Apply to editor is free and goes through Undo / History.',
      'Current due now includes unpaid script-writer charges the moment they land — generate and Talk — with a Script line on the since-last-payment card. The header pill updates without a reload.',
    ],
  },
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
