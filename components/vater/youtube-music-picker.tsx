"use client";

import { useEffect, useRef, useState } from "react";

type MusicTrack = {
  id: string;
  name: string;
  filename: string;
  mood?: string[];
  bpm?: number;
  duration?: number;
  /** Direct MP3 URL (typically incompetech.com). Used for in-browser preview. */
  source_url?: string;
};

interface Props {
  value: string | null;
  volume: number; // 0.0–1.0
  onChange: (id: string | null, volume: number) => void;
  disabled?: boolean;
}

function fmt(s?: number) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

export function YouTubeMusicPicker({ value, volume, onChange, disabled }: Props) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Preview audio — one element reused across tracks. `previewId` tracks
  // which track is currently playing so the button can swap icon + stop the
  // previous track when a new preview starts.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vater/music-catalog")
      .then((r) => r.json())
      .then((d) => setTracks(Array.isArray(d.tracks) ? d.tracks : []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  // Stop any playing preview on unmount so audio doesn't leak into the next
  // page the user navigates to.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const togglePreview = (track: MusicTrack) => {
    if (!track.source_url) return;
    // Clicking an already-playing track stops it.
    if (previewId === track.id) {
      audioRef.current?.pause();
      setPreviewId(null);
      return;
    }
    // Otherwise switch the shared <audio> to the new track.
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPreviewId(null);
    }
    audioRef.current.pause();
    audioRef.current.src = track.source_url;
    audioRef.current.volume = 0.75; // preview volume separate from project vol
    audioRef.current.play().catch(() => {
      // Autoplay denied or network error — clear state.
      setPreviewId(null);
    });
    setPreviewId(track.id);
  };

  const selectedTrack = tracks.find((t) => t.id === value) ?? null;

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
        Loading music catalog…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/40 bg-zinc-900/40 p-3 text-xs text-red-400">
        Music catalog unavailable — {error}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Background Music
        <span className="ml-1 text-[10px] font-normal normal-case text-zinc-600">
          CC-BY-4.0 Kevin MacLeod — optional
        </span>
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {/* None option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null, volume)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${
            value === null
              ? "border-sky-400/60 bg-sky-500/10 ring-1 ring-sky-400/30"
              : "border-zinc-700/60 bg-zinc-900/40 hover:border-zinc-600"
          }`}
        >
          <span className="text-base">🔇</span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-200">No music</div>
            <div className="text-[10px] text-zinc-500">Voice only</div>
          </div>
        </button>

        {tracks.map((track) => {
          const active = value === track.id;
          const playing = previewId === track.id;
          return (
            <div
              key={track.id}
              className={`relative flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                active
                  ? "border-sky-400/60 bg-sky-500/10 ring-1 ring-sky-400/30"
                  : "border-zinc-700/60 bg-zinc-900/40 hover:border-zinc-600"
              }`}
            >
              {/* Main selection surface — clicking the card picks this track. */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(track.id, volume)}
                className="flex flex-col gap-1 pr-9 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-zinc-200">
                    {track.name}
                  </span>
                  {track.bpm && (
                    <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-300">
                      {track.bpm} BPM
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {track.mood?.slice(0, 3).map((m) => (
                    <span
                      key={m}
                      className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] text-zinc-400"
                    >
                      {m}
                    </span>
                  ))}
                  {track.duration && (
                    <span className="ml-auto text-[9px] text-zinc-400">
                      {fmt(track.duration)}
                    </span>
                  )}
                </div>
              </button>
              {/* Preview play/pause button — stops event bubbling so it doesn't
                  also select the track. Absolute-positioned so the selection
                  button takes the full card footprint. */}
              {track.source_url ? (
                <button
                  type="button"
                  aria-label={playing ? `Pause ${track.name}` : `Preview ${track.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePreview(track);
                  }}
                  className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border text-[11px] transition ${
                    playing
                      ? "border-fuchsia-400/70 bg-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.4)]"
                      : "border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-fuchsia-400/50 hover:text-fuchsia-200"
                  }`}
                >
                  {playing ? "❚❚" : "▶"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Volume slider — only when a track is selected */}
      {value !== null && selectedTrack && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <span className="text-[10px] text-zinc-500">Vol</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            disabled={disabled}
            onChange={(e) =>
              onChange(value, parseInt(e.target.value, 10) / 100)
            }
            className="flex-1 accent-sky-400"
          />
          <span className="w-8 text-right text-[10px] text-zinc-400">
            {Math.round(volume * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
