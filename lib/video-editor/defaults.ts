import type { Project, VideoClip, AudioClip, VideoTrack, AudioTrack } from "./types";

export const DEFAULT_FPS = 30;
export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;

export function emptyProject(opts?: Partial<Pick<Project, "fps" | "width" | "height">>): Project {
  return {
    fps: opts?.fps ?? DEFAULT_FPS,
    width: opts?.width ?? DEFAULT_WIDTH,
    height: opts?.height ?? DEFAULT_HEIGHT,
    durationS: 0,
    videoTracks: [{ id: newId("vt"), label: "V1", clips: [] }],
    audioTracks: [{ id: newId("at"), label: "A1", clips: [] }],
    textOverlays: [],
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Sum of (clip.startS + clip.outS - clip.inS) max across every track, capped at 0. */
export function computeDurationS(p: Project): number {
  let max = 0;
  for (const t of p.videoTracks) {
    for (const c of t.clips) {
      const end = c.startS + Math.max(0, c.outS - c.inS);
      if (end > max) max = end;
    }
  }
  for (const t of p.audioTracks) {
    for (const c of t.clips) {
      const end = c.startS + Math.max(0, c.outS - c.inS);
      if (end > max) max = end;
    }
  }
  for (const o of p.textOverlays) {
    const end = o.startS + Math.max(0, o.durationS);
    if (end > max) max = end;
  }
  return Math.round(max * 1000) / 1000;
}

/** Validate + normalize a project before saving. Throws on structural error. */
export function normalize(p: Project): Project {
  if (!Number.isFinite(p.fps) || p.fps < 1) p.fps = DEFAULT_FPS;
  if (!Number.isFinite(p.width) || p.width < 16) p.width = DEFAULT_WIDTH;
  if (!Number.isFinite(p.height) || p.height < 16) p.height = DEFAULT_HEIGHT;
  for (const t of p.videoTracks) sortClips(t);
  for (const t of p.audioTracks) sortClips(t);
  p.textOverlays.sort((a, b) => a.startS - b.startS);
  p.durationS = computeDurationS(p);
  return p;
}

function sortClips(t: VideoTrack | AudioTrack) {
  t.clips.sort((a, b) => a.startS - b.startS);
}

export function newVideoClipFromGeneration(args: {
  generationId: string;
  blobUrl: string;
  durationS: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  startS: number;
}): VideoClip {
  return {
    id: newId("vc"),
    source: {
      kind: "videoGenerationId",
      ref: args.generationId,
      thumbnailUrl: args.thumbnailUrl,
      naturalDurationS: args.durationS,
      width: args.width,
      height: args.height,
    },
    startS: args.startS,
    inS: 0,
    outS: args.durationS,
    transitionOut: "none",
  };
}

export function newAudioClip(args: {
  url: string;
  durationS: number;
  startS: number;
  volume?: number;
  isNarration?: boolean;
}): AudioClip {
  return {
    id: newId("ac"),
    source: {
      kind: args.isNarration ? "narration" : "url",
      ref: args.url,
      naturalDurationS: args.durationS,
    },
    startS: args.startS,
    inS: 0,
    outS: args.durationS,
    volume: args.volume ?? 1,
  };
}
