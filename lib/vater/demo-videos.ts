/**
 * lib/vater/demo-videos.ts — the reel shown on the public /animate landing.
 *
 * These are REAL finished renders from the studio, served from the same
 * Vercel Blob bucket the product delivers customer finals from. `allInUsd`
 * is the reconciled all-in cost of that exact video (compute + ops), the
 * same number the in-app render receipt shows its owner — not an estimate
 * and not a list price.
 *
 * ── CONSENT GATE ─────────────────────────────────────────────────────────
 * `consentStatus: 'pending'` means the person whose script/likeness the
 * video came from has NOT yet signed the showcase-reuse consent. Nothing
 * pending is rendered on the page — the landing maps over LIVE_DEMOS only,
 * and shows a "more coming" tile for the rest. Flip an entry to 'live'
 * ONLY after the consent is on file (Jared queues this on /hq).
 *
 * 2026-08-16: Trey Vater's consent is on file for his WHOLE library, past and
 * future ("anything in Vater you want to use to cut up for demos we can" —
 * relayed by Jared). Record: ~/vater-studio/demo-clips/CONSENT.md. Everything
 * of his below is therefore 'live'.
 *
 * Poster images are static frame grabs committed under public/animate/demos/
 * so the poster costs one small JPEG instead of a video preload.
 */

export type DemoConsentStatus = "live" | "pending";

/** One reconciled line of a finished render's receipt. */
export interface DemoReceiptStage {
  key: string;
  label: string;
  usd: number;
}

/**
 * The reconciled receipt for a demo — the SAME breakdown its owner sees in
 * the studio, transcribed from `YouTubeProject.costJson` after the nightly
 * cost reconciler merged the metered spend (memory: vater-cost-truth-automated).
 *
 * This exists so the public landing's ADMIT ONE meter can itemise a real
 * render instead of an invented pipeline. If a demo has no `receipt`, the
 * landing falls back to the two lines it can derive safely — compute
 * (allInUsd − ops) and ops (minutes × getOpsRate()) — and never guesses at
 * per-stage splits.
 */
export interface DemoReceipt {
  /** Compute lines, at cost, in the order the render incurred them. */
  stages: DemoReceiptStage[];
  /** Render operations: `minutes` × `opsRate`. */
  opsUsd: number;
  /** The ops rate in force when this render was billed ($/finished minute). */
  opsRate: number;
  /** Finished minutes the ops line was billed on. */
  minutes: number;
  /** stages + opsUsd — must equal the demo's `allInUsd`. */
  totalUsd: number;
  /** When the reconciler last wrote this breakdown (ISO 8601). */
  reconciledAt: string;
}

export interface DemoVideo {
  /** Stable key — also the library "#N" number where one exists. */
  id: string;
  /** Title as it appears in the library. */
  title: string;
  /** Blob URL of the finished MP4. */
  url: string;
  /** Path under /public to the poster frame. */
  poster: string;
  /** Human duration, m:ss. */
  duration: string;
  /** Duration in seconds — used for the $/min figure on the card. */
  durationSec: number;
  /** Reconciled all-in cost of this render, in dollars. */
  allInUsd: number;
  /** Showcase-reuse consent state. Only 'live' is ever rendered. */
  consentStatus: DemoConsentStatus;
  /** One line of context under the title. */
  blurb: string;
  /** Reconciled receipt, when one has been transcribed off the project. */
  receipt?: DemoReceipt;
}

export const DEMO_VIDEOS: readonly DemoVideo[] = [
  {
    id: "23",
    title: "The Quiet Exit — My Money Mindset",
    url: "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/vater-finals/cmst8pnwl0001l4ts3hx8hkux.mp4?v=1786734674199",
    poster: "/animate/demos/money-mindset.jpg",
    duration: "3:24",
    durationSec: 204,
    allInUsd: 3.04,
    consentStatus: "live",
    blurb:
      "Written as a script, narrated in a cloned voice, every frame generated in one locked art style.",
    /* Source: YouTubeProject.costJson of cmst8pnwl0001l4ts3hx8hkux (the render
     * behind this MP4), as reconciled 2026-08-14T19:00:03.681Z. The project
     * booked its compute as a single reconciled render line covering two jobs
     * — that is the granularity the ledger actually holds, so that is the
     * granularity printed here. Splitting $1.85 into invented voice / scene /
     * motion lines would be exactly the fake artifact this page exists to
     * avoid. 1.85 + 1.19 = 3.04 = allInUsd. */
    receipt: {
      stages: [
        { key: "render", label: "compute at cost — render · 2 jobs", usd: 1.85 },
      ],
      opsUsd: 1.19,
      opsRate: 0.35,
      minutes: 3.4,
      totalUsd: 3.04,
      reconciledAt: "2026-08-14T19:00:03.681Z",
    },
  },
  {
    id: "19",
    title: "The Three-Account System",
    url: "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/vater-finals/cmso1efqb0001l446nhl1psbl.mp4?v=1786418621471",
    poster: "/animate/demos/three-account-system.jpg",
    duration: "8:44",
    durationSec: 524,
    allInUsd: 5.56,
    consentStatus: "live",
    blurb: "The long-form benchmark render — 8:44 finished, clean on the first pass.",
    /* Source: YouTubeProject.costJson of cmso1efqb0001l446nhl1psbl: byStage.render 1.2426 + byStage.reconciliation.missedRuns 1.26 = totalUsd 2.50; ops 8.74 min × 0.35 = 3.06; 2.50 + 3.06 = 5.56 = allInUsd. */
    receipt: {
      stages: [
        { key: "render", label: "compute at cost — render", usd: 1.24 },
        { key: "reconciliation", label: "compute at cost — re-driven run (reconciled)", usd: 1.26 },
      ],
      opsUsd: 3.06,
      opsRate: 0.35,
      minutes: 8.74,
      totalUsd: 5.56,
      reconciledAt: "2026-08-11T03:40:06.573Z",
    },
  },
  {
    id: "22",
    title: "The Millionaire Teacher Next Door",
    url: "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/vater-finals/cmss163f00001l46xgfygk8ix.mp4?v=1786664853414",
    poster: "/animate/demos/millionaire-teacher.jpg",
    duration: "8:38",
    durationSec: 518,
    allInUsd: 4.49,
    consentStatus: "live",
    blurb: "Second long-form at length, same characters carried across every scene.",
    /* Source: YouTubeProject.costJson of cmss163f00001l46xgfygk8ix: byStage.render 1.4706 (modal 1.3936 + gemini 0.0815) = totalUsd 1.47; ops 8.63 min × 0.35 = 3.02; 1.47 + 3.02 = 4.49 = allInUsd. */
    receipt: {
      stages: [
        { key: "render", label: "compute at cost — render", usd: 1.47 },
      ],
      opsUsd: 3.02,
      opsRate: 0.35,
      minutes: 8.63,
      totalUsd: 4.49,
      reconciledAt: "2026-08-14T02:00:02.344Z",
    },
  },
  {
    id: "16",
    title: "David & Cooper: Two Ways to Save",
    url: "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/vater-finals/cmsnuh74z0001l44efgn8p8hp.mp4?v=1786403956661",
    poster: "/animate/demos/david-cooper.jpg",
    duration: "0:29",
    durationSec: 29,
    allInUsd: 0.73,
    consentStatus: "live",
    blurb: "A short cut from the same pipeline — two characters, one style, 29 seconds.",
    /* Source: YouTubeProject.costJson of cmsnuh74z0001l44efgn8p8hp: stills 0.3492 + modal_overhead 0.2095 + gemini 0.006 (tts/compose local $0) = totalUsd 0.5647 → 0.56 at cents; ops 0.48 min × 0.35 = 0.17; 0.56 + 0.17 = 0.73 = allInUsd. Stage lines rounded to cents so they sum to the reconciled 0.56 (0.35+0.20+0.01). */
    receipt: {
      stages: [
        { key: "stills", label: "compute at cost — stills · 12 calls", usd: 0.35 },
        { key: "modal_overhead", label: "compute at cost — cold-start / CPU uplift", usd: 0.20 },
        { key: "gemini", label: "compute at cost — scene QA vision", usd: 0.01 },
      ],
      opsUsd: 0.17,
      opsRate: 0.35,
      minutes: 0.48,
      totalUsd: 0.73,
      reconciledAt: "2026-08-10T23:19:17.301Z",
    },
  },
];

/** Only these are ever rendered on the public page. */
export const LIVE_DEMOS: readonly DemoVideo[] = DEMO_VIDEOS.filter(
  (d) => d.consentStatus === "live",
);

/** How many finished videos are waiting on a signature. */
export const PENDING_DEMO_COUNT: number = DEMO_VIDEOS.filter(
  (d) => d.consentStatus === "pending",
).length;

/** All-in dollars per finished minute for a demo, e.g. "$0.89/min". */
export function demoPerMinute(d: DemoVideo): string {
  const perMin = d.allInUsd / (d.durationSec / 60);
  return `$${perMin.toFixed(2)}/min`;
}
