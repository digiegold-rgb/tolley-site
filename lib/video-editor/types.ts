/**
 * Timeline editor data model. The full project lives as a single JSON blob in
 * VideoProject.state. The editor mutates it client-side and PATCHes back; the
 * server-side renderer consumes the same JSON via Remotion inputProps.
 */

export type SourceKind = "blob" | "videoGenerationId" | "url" | "narration";

export type ClipSource = {
  kind: SourceKind;
  ref: string;            // blob URL, generationId, or absolute URL
  thumbnailUrl?: string;
  naturalDurationS?: number;
  width?: number;
  height?: number;
};

export type VideoClip = {
  id: string;
  source: ClipSource;
  startS: number;         // position on the timeline
  inS: number;            // trim start in source
  outS: number;           // trim end in source
  fade?: { inS?: number; outS?: number };
  transitionOut?: "none" | "fade" | "dissolve" | "slide";
  transitionDurationS?: number;
};

export type AudioClip = {
  id: string;
  source: ClipSource;
  startS: number;
  inS: number;
  outS: number;
  volume: number;         // 0..1
  fade?: { inS?: number; outS?: number };
};

export type TextPosition =
  | "center"
  | "top"
  | "bottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"
  | { x: number; y: number };

export type TextOverlay = {
  id: string;
  startS: number;
  durationS: number;
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 400 | 600 | 700 | 800 | 900;
  color?: string;
  backgroundColor?: string;
  position?: TextPosition;
  enterAnim?: "none" | "fadeIn" | "slideUp";
  exitAnim?: "none" | "fadeOut" | "slideDown";
};

export type VideoTrack = {
  id: string;
  label?: string;
  clips: VideoClip[];
};

export type AudioTrack = {
  id: string;
  label?: string;
  clips: AudioClip[];
};

export type Project = {
  fps: number;
  width: number;
  height: number;
  durationS: number;
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textOverlays: TextOverlay[];
};
