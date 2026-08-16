/**
 * Landing "NOW SHOWING" carousel — short excerpts of finished renders.
 *
 * Every clip is the first ~8 s of a REAL published video, cut with ffmpeg
 * (960×540 / 540×960, h264, muted-autoplay friendly) and hosted on the
 * vater-finals Blob store under `animate-demo-clips/`. Nothing here is a
 * mock-up: the 16:9 clips are Trey's consented library films (they only
 * render while that film is in LIVE_DEMOS — same consent gate as the hero),
 * the 9:16 clips are the persona shorts Jared picked on 2026-08-16.
 *
 * Source masters + cut recipe: ~/vater-studio/demo-clips/{trey,lady,clips}.
 */

import { LIVE_DEMOS, type DemoVideo } from "./demo-videos";

export type ClipAspect = "16x9" | "9x16";
export type ClipOwner = "trey" | "lady";

export interface DemoClip {
  /** Stable key. */
  id: string;
  owner: ClipOwner;
  aspect: ClipAspect;
  /** Blob URL of the excerpt (≈8 s, faststart). */
  src: string;
  /** Blob URL of the poster frame. */
  poster: string;
  /** Title shown on the caption plate. */
  title: string;
  /** Where the excerpt is from — full film / the short itself. */
  href: string;
  /** Length of the FULL piece, m:ss. */
  fullDuration: string;
  /** For Trey clips: the library demo this excerpt is cut from. */
  demoId?: string;
}

const BLOB = "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/animate-demo-clips";

const ALL_CLIPS: readonly DemoClip[] = [
  {
    id: "trey-23", owner: "trey", aspect: "16x9", demoId: "23",
    src: `${BLOB}/trey-23-16x9.mp4`, poster: `${BLOB}/trey-23-poster.jpg`,
    title: "The Quiet Exit — My Money Mindset", href: "", fullDuration: "",
  },
  {
    id: "lady-kc-housing", owner: "lady", aspect: "9x16",
    src: `${BLOB}/lady-kc-housing-9x16.mp4`, poster: `${BLOB}/lady-kc-housing-poster.jpg`,
    title: "KC Housing Daily — Aug 10", href: "https://www.youtube.com/shorts/WkdxwzYHSjk", fullDuration: "0:30",
  },
  {
    id: "trey-19", owner: "trey", aspect: "16x9", demoId: "19",
    src: `${BLOB}/trey-19-16x9.mp4`, poster: `${BLOB}/trey-19-poster.jpg`,
    title: "The Three-Account System", href: "", fullDuration: "",
  },
  {
    id: "lady-shark-styler", owner: "lady", aspect: "9x16",
    src: `${BLOB}/lady-shark-styler-9x16.mp4`, poster: `${BLOB}/lady-shark-styler-poster.jpg`,
    title: "The $320 Shark Styler — Who Should Skip It", href: "https://www.youtube.com/shorts/9_9ZPEG3xJI", fullDuration: "0:40",
  },
  {
    id: "trey-22", owner: "trey", aspect: "16x9", demoId: "22",
    src: `${BLOB}/trey-22-16x9.mp4`, poster: `${BLOB}/trey-22-poster.jpg`,
    title: "The Millionaire Teacher Next Door", href: "", fullDuration: "",
  },
  {
    id: "lady-laundry-nook", owner: "lady", aspect: "9x16",
    src: `${BLOB}/lady-laundry-nook-9x16.mp4`, poster: `${BLOB}/lady-laundry-nook-poster.jpg`,
    title: "The First-Apartment Cheat Code in Your Laundry Nook", href: "https://www.youtube.com/shorts/m_PTl5g06rA", fullDuration: "0:30",
  },
  {
    id: "trey-16", owner: "trey", aspect: "16x9", demoId: "16",
    src: `${BLOB}/trey-16-16x9.mp4`, poster: `${BLOB}/trey-16-poster.jpg`,
    title: "David & Cooper: Two Ways to Save", href: "", fullDuration: "",
  },
  {
    id: "lady-vintage-suitcases", owner: "lady", aspect: "9x16",
    src: `${BLOB}/lady-vintage-suitcases-9x16.mp4`, poster: `${BLOB}/lady-vintage-suitcases-poster.jpg`,
    title: "Everyone Says Vintage Suitcases Are Clutter. $10 Proved Them Wrong", href: "https://www.youtube.com/shorts/eclu87gfBKk", fullDuration: "0:45",
  },
];

/** A clip plus, for library excerpts, the live demo it was cut from. */
export interface LiveClip extends DemoClip {
  demo?: DemoVideo;
}

/**
 * Clips safe to show publicly. Library excerpts are joined to LIVE_DEMOS —
 * if a film's consent flips, its excerpt disappears with it and the title /
 * duration / all-in cost printed on the plate come from that record.
 */
export const LIVE_CLIPS: readonly LiveClip[] = ALL_CLIPS.flatMap((c) => {
  if (c.owner !== "trey") return [c];
  const demo = LIVE_DEMOS.find((d) => d.id === c.demoId);
  if (!demo) return [];
  return [{ ...c, demo, title: demo.title, href: demo.url, fullDuration: demo.duration }];
});
