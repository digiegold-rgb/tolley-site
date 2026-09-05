"use client";

import {
  canStitchBeats,
  emptyBeat,
  nextBeatActionLabel,
  stitchBlockers,
  type BeatQueue,
  type MotionBeat,
} from "@/lib/generate-beats";
import type { GenerateMotionCard } from "@/lib/generate-motion-card";

function mediaSrc(jobId: string, index = 0): string {
  return `/api/generate/jobs/${encodeURIComponent(jobId)}/image?i=${index}`;
}

export function GatedClip({
  src,
  playbackRate = 1,
  label,
  poster,
}: {
  src: string;
  playbackRate?: number;
  label?: string;
  poster?: string;
}) {
  return (
    <div className="gen-gated-clip">
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        poster={poster}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (playbackRate !== 1) el.playbackRate = playbackRate;
        }}
      />
      {label ? <p className="gen-clip-label">{label}</p> : null}
    </div>
  );
}

export function BeatQueuePanel({
  queue,
  busy,
  onAddFromCard,
  onAddEmpty,
  onRemove,
  onMove,
  onPatch,
  onGenerate,
  onApprove,
  onReject,
  onReset,
  onStitch,
}: {
  queue: BeatQueue;
  busy: boolean;
  onAddFromCard: () => void;
  onAddEmpty: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onPatch: (id: string, patch: Partial<MotionBeat>) => void;
  onGenerate: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReset: (id: string) => void;
  onStitch: () => void;
}) {
  const stitch = canStitchBeats(queue);
  const blockers = stitchBlockers(queue);
  return (
    <section className="gen-beats" aria-label="Beat queue">
      <div className="gen-beats-head">
        <div>
          <p className="gen-label gen-label-live">Beat queue</p>
          <p className="gen-hint">
            One Wan clip per beat (~5s). Review, regenerate, approve. Stitch only when every beat is
            approved — never on Go.
          </p>
        </div>
        <div className="gen-beats-actions">
          <button type="button" className="gen-seed-random" disabled={busy} onClick={onAddFromCard}>
            Add current card
          </button>
          <button type="button" className="gen-seed-random" disabled={busy} onClick={onAddEmpty}>
            Add empty beat
          </button>
        </div>
      </div>
      {queue.beats.length === 0 ? (
        <p className="gen-hint">No beats yet. Add the current Motion card, or start empty.</p>
      ) : (
        <ol className="gen-beat-list">
          {queue.beats.map((beat, i) => (
            <li key={beat.id} className={`gen-beat gen-beat-${beat.status}`}>
              <div className="gen-beat-top">
                <span className="gen-beat-num">Beat {i + 1}</span>
                <span className={`gen-beat-status gen-beat-status-${beat.status}`}>{beat.status}</span>
                <div className="gen-beat-move">
                  <button type="button" disabled={busy || i === 0} onClick={() => onMove(beat.id, -1)}>
                    Up
                  </button>
                  <button
                    type="button"
                    disabled={busy || i === queue.beats.length - 1}
                    onClick={() => onMove(beat.id, 1)}
                  >
                    Down
                  </button>
                  <button type="button" disabled={busy} onClick={() => onRemove(beat.id)}>
                    Remove
                  </button>
                </div>
              </div>
              <label className="gen-field gen-field-wide">
                Motion prompt
                <textarea
                  className="gen-box gen-box-description"
                  value={beat.prompt}
                  disabled={busy || beat.status === "generating"}
                  onChange={(e) => onPatch(beat.id, { prompt: e.target.value })}
                />
              </label>
              <label className="gen-field gen-field-wide">
                Source still
                <input
                  value={beat.source_image_url}
                  disabled={busy || beat.status === "generating"}
                  onChange={(e) => onPatch(beat.id, { source_image_url: e.target.value, from_prev_last: false })}
                />
              </label>
              {i > 0 && (
                <label className="gen-check">
                  <input
                    type="checkbox"
                    checked={beat.from_prev_last}
                    disabled={busy || beat.status === "generating"}
                    onChange={(e) => onPatch(beat.id, { from_prev_last: e.target.checked })}
                  />
                  Use previous beat still (end pose, or source)
                </label>
              )}
              <label className="gen-field gen-field-wide">
                End still (optional FLF2V)
                <input
                  value={beat.end_image_url}
                  disabled={busy || beat.status === "generating"}
                  onChange={(e) => onPatch(beat.id, { end_image_url: e.target.value })}
                />
              </label>
              <div className="gen-row">
                <button
                  type="button"
                  className={`gen-nsfw-chip${beat.slow_mo ? " gen-nsfw-chip-on" : ""}`}
                  disabled={busy || beat.status === "generating"}
                  aria-pressed={beat.slow_mo}
                  onClick={() => onPatch(beat.id, { slow_mo: !beat.slow_mo })}
                >
                  0.5× slow-mo
                </button>
                <button
                  type="button"
                  className="gen-seed-random"
                  disabled={busy || beat.status === "generating"}
                  onClick={() => onGenerate(beat.id)}
                >
                  {beat.status === "draft" || beat.status === "rejected"
                    ? nextBeatActionLabel(beat)
                    : beat.status === "ready" || beat.status === "approved"
                      ? "Regenerate"
                      : nextBeatActionLabel(beat)}
                </button>
                {beat.status === "ready" || beat.status === "rejected" ? (
                  <button type="button" className="gen-seed-random" disabled={busy} onClick={() => onApprove(beat.id)}>
                    Approve
                  </button>
                ) : null}
                {beat.status === "ready" || beat.status === "approved" ? (
                  <button type="button" className="gen-seed-random" disabled={busy} onClick={() => onReject(beat.id)}>
                    Reject
                  </button>
                ) : null}
                {beat.status === "approved" ? (
                  <button type="button" className="gen-seed-random" disabled={busy} onClick={() => onReset(beat.id)}>
                    Unapprove
                  </button>
                ) : null}
              </div>
              {beat.error ? <p className="gen-err">{beat.error}</p> : null}
              {beat.job_id && (beat.status === "ready" || beat.status === "approved" || beat.status === "rejected") ? (
                <GatedClip
                  src={mediaSrc(beat.job_id, 0)}
                  playbackRate={beat.slow_mo ? 0.5 : 1}
                  label={
                    beat.slow_mo
                      ? "0.5× slow-mo — remux after Wan when ffmpeg is on the runtime; otherwise playbackRate."
                      : undefined
                  }
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <div className="gen-beats-stitch">
        <button type="button" className="gen-go" disabled={busy || !stitch.ok} onClick={onStitch}>
          Stitch approved beats
        </button>
        {!stitch.ok && blockers[0] ? <p className="gen-hint">{blockers[0]}</p> : null}
        {queue.stitch_error ? <p className="gen-err">{queue.stitch_error}</p> : null}
        {queue.stitch_job_id ? (
          <GatedClip src={mediaSrc(queue.stitch_job_id, 0)} label="Stitched MP4 — simple concat on Vercel ffmpeg" />
        ) : null}
      </div>
    </section>
  );
}

export function SlowMoChip({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="gen-slowmo">
      <button
        type="button"
        className={`gen-nsfw-chip${on ? " gen-nsfw-chip-on" : ""}`}
        disabled={disabled}
        aria-pressed={on}
        onClick={onToggle}
      >
        0.5× slow-mo
      </button>
      <p className="gen-field-hint">
        After Wan returns (~5s), remux with ffmpeg <code>setpts=2*PTS</code> so the export plays at half
        speed (~10s). Same frames — not a longer fal call. If remux is unavailable, the in-page player
        uses <code>playbackRate=0.5</code> and is labeled.
      </p>
    </div>
  );
}

export function cardToNewBeat(card: GenerateMotionCard | { source_image_url?: string; prompt?: string; negative_prompt?: string; end_image_url?: string; aspect?: MotionBeat["aspect"]; seed?: number; slow_mo?: boolean }): MotionBeat {
  return emptyBeat({
    prompt: card.prompt,
    negative_prompt: card.negative_prompt,
    source_image_url: card.source_image_url,
    end_image_url: card.end_image_url,
    aspect: card.aspect,
    seed: card.seed,
    slow_mo: card.slow_mo === true,
  });
}
