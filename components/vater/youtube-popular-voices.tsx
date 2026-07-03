"use client";

/**
 * YouTubePopularVoices — inline demo panel showing ~8 popular ElevenLabs
 * shared voices with preview play buttons. Rendered above the voice clone
 * picker in the context form so the user can audition before deciding
 * which voice to clone / use.
 *
 * Selection isn't wired to the project payload yet (the creation pipeline
 * still expects a local voice clone name). This panel is currently
 * demo-only; clicking a voice plays audio, doesn't set state.
 */
import { useEffect, useRef, useState } from "react";

type PopularVoice = {
  voice_id: string;
  name: string;
  gender: "male" | "female" | null;
  description: string | null;
  preview_url: string | null;
  cloned_by_count: number | null;
};

function formatClones(n: number | null): string {
  if (n === null) return "";
  if (n >= 1000) return `${Math.round(n / 1000)}K users`;
  return `${n} users`;
}

export function YouTubePopularVoices() {
  const [voices, setVoices] = useState<PopularVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/vater/elevenlabs/popular-voices");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (alive) setVoices(data.voices ?? []);
      } catch (err) {
        if (alive)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Stop playback on unmount so nothing leaks when the form closes.
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const toggle = (v: PopularVoice) => {
    if (!v.preview_url) return;
    if (playingId === v.voice_id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingId(null);
    }
    audioRef.current.pause();
    audioRef.current.src = v.preview_url;
    audioRef.current.volume = 0.85;
    audioRef.current.play().catch(() => setPlayingId(null));
    setPlayingId(v.voice_id);
  };

  return (
    <div className="rounded-lg border border-sky-500/25 bg-gradient-to-br from-sky-500/5 to-transparent p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-sky-300">
          ✦ Popular voices (ElevenLabs)
          <span className="ml-2 text-[10px] font-normal normal-case text-zinc-400">
            audition before you clone
          </span>
        </div>
        {voices.length > 0 && (
          <span className="text-[10px] text-zinc-400">
            {voices.length} featured
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-[11px] text-zinc-400">Loading popular voices…</p>
      ) : error ? (
        <p className="text-[11px] text-rose-300">
          Couldn&rsquo;t load popular voices — {error}
        </p>
      ) : voices.length === 0 ? (
        <p className="text-[11px] text-zinc-400">
          No popular voices available right now.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {voices.map((v) => {
            const playing = playingId === v.voice_id;
            return (
              <div
                key={v.voice_id}
                className={`flex items-start gap-2 rounded-md border px-2.5 py-2 transition ${
                  playing
                    ? "border-fuchsia-400/60 bg-fuchsia-500/10 shadow-[0_0_10px_rgba(217,70,239,0.3)]"
                    : "border-zinc-700/60 bg-zinc-900/40"
                }`}
              >
                <button
                  type="button"
                  aria-label={
                    playing ? `Pause ${v.name}` : `Preview ${v.name}`
                  }
                  disabled={!v.preview_url}
                  onClick={() => toggle(v)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] transition ${
                    playing
                      ? "border-fuchsia-400 bg-fuchsia-500/30 text-fuchsia-100"
                      : v.preview_url
                        ? "border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-fuchsia-400/60 hover:text-fuchsia-200"
                        : "cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  }`}
                >
                  {playing ? "❚❚" : "▶"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-xs font-semibold text-zinc-100">
                      {v.name}
                    </div>
                    {v.gender && (
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-300">
                        {v.gender}
                      </span>
                    )}
                  </div>
                  {v.description && (
                    <p className="line-clamp-2 text-[10px] text-zinc-400">
                      {v.description}
                    </p>
                  )}
                  {v.cloned_by_count !== null && (
                    <p className="mt-0.5 text-[9px] text-sky-300/80">
                      cloned by {formatClones(v.cloned_by_count)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[10px] text-zinc-400">
        These previews are for reference. To actually use one, clone the voice
        in the Voices tab, then pick it below.
      </p>
    </div>
  );
}
