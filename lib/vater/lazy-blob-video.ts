/**
 * Lazy blob-video policy for Socials thumbs and Library cards.
 *
 * Investigation (2026-09-01, Ruthann ~112 DGX mp4s on vater-finals):
 * 1) CONFIRMED — StudioVideoThumb and LibraryCard mounted
 *    `<video preload=metadata>` for every `final-video` tile at rest.
 *    Opening Socials hit blob.vercel-storage.com N times (N = library size).
 * 2) CONFIRMED — GET /api/vater/socials/studio waited on Zernio + serial
 *    house match + full project rows before the tab painted.
 * 3) CONFIRMED — Socials → Library remounted the grid, waited on
 *    GET /api/vater/youtube, then eager-mounted the same blob videos.
 *
 * Rest-state first-frame (PR #108) stays correct for a VISIBLE / selected
 * card. Offscreen tiles must not mount media. Concurrent blob loads are
 * capped so a dense visible window cannot stampede the CDN.
 *
 * Does not generate thumbnail files. Does not write HQ view-counter tables.
 */

export const MAX_CONCURRENT_BLOB_VIDEOS = 6;

/**
 * Rest-state frame for an mp4 tile. DGX renders fade in from black, so the
 * first frames (and the old 0.05s seek) paint a black tile in a "full"
 * library. Seek far enough in to clear the fade, but never past the first
 * fifth of a short clip.
 */
export function restFrameTime(duration: number | null | undefined): number {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return 0.1;
  return Math.min(1.2, Math.max(0.1, duration * 0.2));
}

export type LazyBlobMountInput = {
  previewKind: string;
  /** thumbnailUrl or firstSceneImage — Socials should use <img>, not <video>. */
  hasStill: boolean;
  inView: boolean;
  /** Library hover-play. Ignored when the tile is offscreen. */
  hover?: boolean;
  /**
   * Selected Library card. The lightbox player owns that blob; the card
   * itself must not also mount a <video>.
   */
  selected?: boolean;
};

/**
 * Whether a grid tile may mount a <video> element.
 * Offscreen = no media. Stills win over eager mp4s. Hover-play only in view.
 */
export function shouldMountThumbVideo(input: LazyBlobMountInput): boolean {
  if (input.selected) return false;
  if (input.hover && input.inView) return true;
  if (input.hasStill) return false;
  if (input.previewKind === "final-video") return input.inView;
  return false;
}

/** Policy without layout — LazyBlobVideo still requires the tile to be on screen. */
export function mayMountThumbVideo(input: Omit<LazyBlobMountInput, "inView">): boolean {
  return shouldMountThumbVideo({ ...input, inView: true });
}

export class BlobVideoGate {
  readonly max: number;
  private readonly active = new Set<string>();
  private readonly waiting = new Map<string, () => void>();

  constructor(max = MAX_CONCURRENT_BLOB_VIDEOS) {
    this.max = max;
  }

  get size(): number {
    return this.active.size;
  }

  has(id: string): boolean {
    return this.active.has(id);
  }

  /** Immediate grant. False when the cap is full (caller may enqueue). */
  request(id: string): boolean {
    if (this.active.has(id)) return true;
    if (this.active.size >= this.max) return false;
    this.active.add(id);
    return true;
  }

  enqueue(id: string, grant: () => void): () => void {
    if (this.active.has(id) || this.request(id)) {
      grant();
      return () => undefined;
    }
    this.waiting.set(id, grant);
    return () => {
      this.waiting.delete(id);
    };
  }

  release(id: string): void {
    this.active.delete(id);
    this.waiting.delete(id);
    for (const [wid, next] of this.waiting) {
      if (this.active.size >= this.max) break;
      this.waiting.delete(wid);
      this.active.add(wid);
      next();
    }
  }

  reset(): void {
    this.active.clear();
    this.waiting.clear();
  }
}

/** Shared gate for Socials + Library tiles in this tab. */
export const blobVideoGate = new BlobVideoGate();
