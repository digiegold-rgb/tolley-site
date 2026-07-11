// Shared types + small pure helpers for the Action Cam dashboard.

export type RecapSource = "dji" | "pool";

export type RecapCategory = "recap" | "reel" | "timelapse" | "season";

export type RecapKind = "daily" | "weekly" | "monthly" | "monthlyreel" | "event";

export type Recap = {
  name: string; period: string; kind: RecapKind;
  periodKey?: string;        // pipeline WORK key (differs for events/monthly reels)
  aspect: "16x9" | "9x16"; aspectLabel: string; sizeMB: number; mtime: string;
  category?: RecapCategory;  // recap | reel (Best Splashes/Critters) | timelapse | season
  key?: string;              // dashboard card key "<period>|<kind>|<source>"
  folder?: string | null;    // user-assigned folder name (virtual grouping)
  source?: RecapSource;      // camera track: "dji" (Action Cam) or "pool" (UniFi G6 180)
  sourceLabel?: string;      // human label for the track ("Action Cam" / "Pool")
  url: string; webUrl?: string;
  title?: string | null;     // custom label (sidecar) — falls back to period when unset
  thumbUrl?: string;         // JPG poster frame
  previewUrl?: string;       // 480p muted proxy for hover-to-play
};

// User-named folders for organizing recaps (virtual — files never move on disk).
export type Folders = { folders: string[]; assign: Record<string, string> };

// One durable build/ingest history record (state/jobs.json on the DGX)
export type JobRecord = {
  id?: string; kind: string; period: string; status: string;
  started: number; ended?: number; error?: string; source?: string;
  stageLabel?: string; pct?: number; built?: boolean;
};

export type Status = {
  ok: boolean; nasMounted: boolean; today: string;
  clips: { total: number; byStatus: Record<string, number>; today: number };
  incomingWaiting: number;
  storage: {
    totalGB: number; usedGB: number; freeGB: number;
    reclaimableGB?: number; reclaimCandidates?: number; reclaimedGB?: number;
  } | null;
  recaps: Recap[]; lastRecap: Recap | null; incomingPath: string;
  lastJob?: JobRecord | null;
};

export type Disposition = "recap" | "keep" | "work" | "private";

export type Clip = { name: string; durationS: number; status: string; disposition: Disposition; reviewed: boolean; url: string | null; webUrl?: string | null; previewUrl?: string | null; thumbUrl?: string | null; trimmed?: boolean };

export type SeqRange = { from: number; to: number; count: number };

export type DayCoverage = {
  tree: boolean;            // was the camera SMB tree cross-checked? (else counts only)
  videos: number;          // MP4s uploaded to the NAS
  photos: number;          // JPGs uploaded (NOT missing footage — shared DJI counter)
  ingested: number;        // videos registered in the pipeline
  notIngested: SeqRange[];  // uploaded videos not yet ingested (on NAS, recoverable)
  notIngestedCount: number;
  missing: number;         // counter slots with NO file = genuine Wi-Fi skip, still on SD
  missingRanges: SeqRange[];
  first: number; last: number;
};

export type OriginalsDay = { day: string; clips: Clip[]; coverage?: DayCoverage | null };

// A camera still + whether the recap auto-picked it (⭐)
export type PhotoItem = { name: string; time: string | null; url: string; thumbUrl: string; picked: boolean; score: number | null; faces: number | null };
export type PhotoDay = { day: string; count: number; pickedCount: number; photos: PhotoItem[] };

// Live build/rebuild job (one at a time — the DGX builds serially)
export type JobState = {
  id: string; period: string; kind: string; label: string; status: string;
  pct: number; stageLabel: string; started: number; error?: string;
};

// One slice of a recap's timeline, editable in the Edit tab
export type EditSlice = {
  i: number; src: string; name: string | null; clipKey?: string | null;
  start: number; end: number; dur: number; score?: number; previewUrl: string | null;
  // per-signal score breakdown (why this slice made the cut)
  smile?: number | null; audio?: number | null; motion?: number | null; subject?: number | null;
};
export type EditTimeline = {
  period: string; kind: string; totalS: number; count: number;
  slices: EditSlice[]; recapUrl: string | null; recapName: string;
};

export type FsEntry = { name: string; isDir: boolean; rel: string; sizeMB: number | null; mtime: string; isVideo: boolean };

// One scored scene of an original (from moments.json) — drives the trimmer heatmap.
export type Scene = {
  start: number; end: number; dur?: number; score: number;
  smile?: number | null; audio?: number | null; motion?: number | null; subject?: number | null;
};

// Auto-trim plan / reclaim candidate for one original. `keepRanges` are the [start,end]
// windows the slimmed file would contain (a superset of what the recap used).
export type TrimPlan = {
  clipKey?: string | null; name: string; src?: string | null; day?: string | null;
  durationS: number; origBytes?: number; keepRanges: number[][];
  keptS?: number; estKeptBytes?: number; estReclaimBytes?: number;
  sceneCount?: number; keptCount?: number; skip?: boolean; reason?: string;
  scenes?: Scene[]; webUrl?: string | null; previewUrl?: string | null;
};

export const fmtGB = (bytes?: number | null) =>
  bytes == null ? "—" : `${(bytes / 1e9).toFixed(bytes < 1e9 ? 2 : 1)} GB`;

// DJI counter -> "0008" ; a range -> "#0123–#0132" (single -> "#0196")
export const pad4 = (n: number) => String(n).padStart(4, "0");
export const rangeLabel = (g: { from: number; to: number }) =>
  g.from === g.to ? `#${pad4(g.from)}` : `#${pad4(g.from)}–#${pad4(g.to)}`;

// "2026-06-06" -> "Saturday, June 6" (falls back to the raw id for week ids)
export const dayLabel = (day: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
};

export const DISPOSITIONS: { id: Disposition; label: string; icon: string; hint: string }[] = [
  { id: "recap", label: "Recap", icon: "🎬", hint: "Auto-edited into the recap + pushed to Plex" },
  { id: "keep", label: "Keep", icon: "📦", hint: "Archived & viewable, but never auto-recapped" },
  { id: "work", label: "Work", icon: "💼", hint: "Hidden in Private tab — never recapped or on Plex" },
  { id: "private", label: "Private", icon: "🔒", hint: "Hidden in Private tab — never recapped or on Plex" },
];

// Clips this short are almost always accidental taps / dead air. Surface them at
// the top of the day so they can be reviewed-then-deleted first (still kept in
// case one's a keeper). 3s threshold = "1, 2 or 3 second" clips.
export const SHORT_CLIP_S = 3;
export const isShortClip = (c: Clip) => !!c.durationS && c.durationS <= SHORT_CLIP_S;
// Stable: short clips first (shortest first), everything else keeps its order.
export const shortFirst = (clips: Clip[]) =>
  clips
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const sa = isShortClip(a.c), sb = isShortClip(b.c);
      if (sa !== sb) return sa ? -1 : 1;
      if (sa && sb) return (a.c.durationS || 0) - (b.c.durationS || 0);
      return a.i - b.i;
    })
    .map((x) => x.c);
