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
 * ONLY after the written consent is on file (Jared queues this on /hq).
 *
 * Poster images are static frame grabs committed under public/animate/demos/
 * so the poster costs one small JPEG instead of a video preload.
 */

export type DemoConsentStatus = "live" | "pending";

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
  },
  {
    id: "19",
    title: "The Three-Account System",
    url: "",
    poster: "",
    duration: "8:44",
    durationSec: 524,
    allInUsd: 5.56,
    consentStatus: "pending",
    blurb: "The long-form benchmark render — 8:44 finished, clean on the first pass.",
  },
  {
    id: "22",
    title: "The Millionaire Teacher Next Door",
    url: "",
    poster: "",
    duration: "8:38",
    durationSec: 518,
    allInUsd: 4.49,
    consentStatus: "pending",
    blurb: "Second long-form at length, same characters carried across every scene.",
  },
  {
    id: "16",
    title: "David & Cooper: Two Ways to Save",
    url: "",
    poster: "",
    duration: "0:29",
    durationSec: 29,
    allInUsd: 0.73,
    consentStatus: "pending",
    blurb: "A short cut from the same pipeline — two characters, one style, 29 seconds.",
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
