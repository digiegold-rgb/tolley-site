"use client";

import { useEffect, useRef, useState } from "react";
import {
  canStitchBeats,
  emptyBeat,
  nextBeatActionLabel,
  stitchBlockers,
  type BeatQueue,
  type MotionBeat,
} from "@/lib/generate-beats";
import { beatPromptEditorForIndex } from "@/lib/generate-studio-motion-sync";
import {
  MOTION_SECONDS_CHIPS,
  wan30UsdEstimate,
  type GenerateMotionCard,
} from "@/lib/generate-motion-card";

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

export function DurationChips({
  seconds,
  disabled,
  onPick,
}: {
  seconds: number;
  disabled?: boolean;
  onPick: (seconds: number) => void;
}) {
  return (
    <div className="gen-nsfw-chips" role="group" aria-label="Segment length">
      {MOTION_SECONDS_CHIPS.map((n) => (
        <button
          key={n}
          type="button"
          className={`gen-nsfw-chip${seconds === n ? " gen-nsfw-chip-on" : ""}`}
          disabled={disabled}
          aria-pressed={seconds === n}
          onClick={() => onPick(n)}
        >
          {n}s
        </button>
      ))}
    </div>
  );
}

export function wan30PriceHint(seconds: number): string {
  return `~$${wan30UsdEstimate(seconds, "720p").toFixed(2)} @720p · ~$${wan30UsdEstimate(seconds, "1080p").toFixed(2)} @1080p`;
}

function stillSummary(beat: MotionBeat, index: number): string {
  const bits: string[] = [];
  if (index > 0 && beat.from_prev_last) bits.push("prev still");
  else if (beat.source_image_url.trim()) bits.push("source still");
  else bits.push("no source");
  if (beat.end_image_url.trim()) bits.push("end still");
  if (beat.job_id) bits.push("clip");
  return bits.join(" · ");
}

function generateLabel(beat: MotionBeat): string {
  if (beat.status === "draft" || beat.status === "rejected") return nextBeatActionLabel(beat);
  if (beat.status === "ready" || beat.status === "approved") return "Regenerate";
  return nextBeatActionLabel(beat);
}

function BeatActions({
  beat,
  busy,
  hideSlowMo,
  onGenerate,
  onApprove,
  onReject,
  onReset,
  onPatch,
}: {
  beat: MotionBeat;
  busy: boolean;
  hideSlowMo?: boolean;
  onGenerate: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReset: (id: string) => void;
  onPatch: (id: string, patch: Partial<MotionBeat>) => void;
}) {
  return (
    <div className="gen-beat-actions">
      {hideSlowMo ? null : (
        <button
          type="button"
          className={`gen-nsfw-chip${beat.slow_mo ? " gen-nsfw-chip-on" : ""}`}
          disabled={busy || beat.status === "generating"}
          aria-pressed={beat.slow_mo}
          onClick={() => onPatch(beat.id, { slow_mo: !beat.slow_mo })}
        >
          0.5× slow-mo
        </button>
      )}
      <button
        type="button"
        className="gen-seed-random"
        disabled={busy || beat.status === "generating"}
        onClick={() => onGenerate(beat.id)}
      >
        {generateLabel(beat)}
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
  );
}

function BeatStillFields({
  beat,
  index,
  busy,
  onPatch,
}: {
  beat: MotionBeat;
  index: number;
  busy: boolean;
  onPatch: (id: string, patch: Partial<MotionBeat>) => void;
}) {
  return (
    <div className="gen-beat-stills">
      <label className="gen-field gen-field-wide">
        Source still
        <input
          value={beat.source_image_url}
          disabled={busy || beat.status === "generating"}
          onChange={(e) => onPatch(beat.id, { source_image_url: e.target.value, from_prev_last: false })}
        />
      </label>
      {index > 0 && (
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
    </div>
  );
}

export function BeatQueuePanel({
  queue,
  busy,
  selectedId: selectedIdProp,
  onSelect,
  onAddFromCard,
  addFromLabel,
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
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAddFromCard: () => void;
  addFromLabel?: string;
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
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    if (id) onSelect?.(id);
    if (selectedIdProp === undefined) setInternalSelectedId(id);
  };
  const prevLen = useRef(queue.beats.length);
  const selected = queue.beats.find((b) => b.id === selectedId) ?? null;
  const selectedIndex = selected ? queue.beats.findIndex((b) => b.id === selected.id) : -1;
  const copyIndex = selectedIndex >= 0 ? selectedIndex : 0;

  useEffect(() => {
    const ids = queue.beats.map((b) => b.id);
    if (!ids.length) {
      prevLen.current = 0;
      return;
    }
    if (queue.beats.length > prevLen.current) {
      setSelectedId(ids[ids.length - 1]);
    } else if (!selectedId || !ids.includes(selectedId)) {
      setSelectedId(ids[0]);
    }
    prevLen.current = queue.beats.length;
    // setSelectedId is stable enough for this length/id repair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.beats, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const node = document.querySelector<HTMLElement>(`[data-beat-id="${selectedId}"]`);
    node?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <section className="gen-beats" aria-label="Beat queue">
      <div className="gen-beats-head">
        <div>
          <p className="gen-label gen-label-live">Beat queue</p>
          <p className="gen-hint">
            Beat 1 is the form above. Left → right timeline for Beat 1…N. Select Beat 2+ to edit
            that beat below. One Wan clip per beat (~5s). Stitch only when every beat is approved —
            never on Go.
          </p>
        </div>
        <div className="gen-beats-actions">
          <button type="button" className="gen-seed-random" disabled={busy} onClick={onAddFromCard}>
            {addFromLabel || `Copy Beat ${copyIndex + 1} as next`}
          </button>
          <button type="button" className="gen-seed-random" disabled={busy} onClick={onAddEmpty}>
            Add empty beat
          </button>
        </div>
      </div>
      {queue.beats.length === 0 ? (
        <p className="gen-hint">Beat 1 seeds from the form above. Add Beat 2+ here.</p>
      ) : (
        <div className="gen-beat-timeline" role="region" aria-label="Beat timeline">
          <ol className="gen-beat-strip">
            {queue.beats.map((beat, i) => (
              <li
                key={beat.id}
                data-beat-id={beat.id}
                className={`gen-beat gen-beat-${beat.status}${selectedId === beat.id ? " gen-beat-selected" : ""}`}
              >
                <button
                  type="button"
                  className="gen-beat-select"
                  aria-pressed={selectedId === beat.id}
                  onClick={() => setSelectedId(beat.id)}
                >
                  <span className="gen-beat-num">Beat {i + 1}</span>
                  <span className={`gen-beat-status gen-beat-status-${beat.status}`}>{beat.status}</span>
                </button>
                <div className="gen-beat-move">
                  <button type="button" disabled={busy || i === 0} onClick={() => onMove(beat.id, -1)}>
                    Left
                  </button>
                  <button
                    type="button"
                    disabled={busy || i === queue.beats.length - 1}
                    onClick={() => onMove(beat.id, 1)}
                  >
                    Right
                  </button>
                  <button type="button" disabled={busy} onClick={() => onRemove(beat.id)}>
                    Remove
                  </button>
                </div>
                {beatPromptEditorForIndex(i).filmstripTextarea ? (
                  <label className="gen-field gen-field-wide">
                    Motion prompt
                    <textarea
                      className="gen-box gen-beat-prompt"
                      value={beat.prompt}
                      disabled={busy || beat.status === "generating"}
                      rows={3}
                      onFocus={() => setSelectedId(beat.id)}
                      onChange={(e) => onPatch(beat.id, { prompt: e.target.value })}
                    />
                  </label>
                ) : (
                  <p className="gen-beat-prompt-preview">{beat.prompt.trim() || "Prompt & stills above"}</p>
                )}
                <p className="gen-beat-meta">
                  {i === 0 ? "Prompt & stills above" : stillSummary(beat, i)}
                  {i === 0 && beat.job_id ? " · clip" : ""}
                </p>
                {i > 0 ? (
                  <details className="gen-beat-more">
                    <summary>Stills</summary>
                    <BeatStillFields beat={beat} index={i} busy={busy} onPatch={onPatch} />
                  </details>
                ) : null}
                <BeatActions
                  beat={beat}
                  busy={busy}
                  hideSlowMo={i === 0}
                  onGenerate={onGenerate}
                  onApprove={onApprove}
                  onReject={onReject}
                  onReset={onReset}
                  onPatch={onPatch}
                />
                {beat.error ? <p className="gen-err">{beat.error}</p> : null}
              </li>
            ))}
            <li className="gen-beat gen-beat-stitch-end">
              <span className="gen-beat-num">Stitch</span>
              <p className="gen-beat-meta">
                {stitch.ok ? "All beats approved" : blockers[0] || "Approve every beat"}
              </p>
              <button type="button" className="gen-go" disabled={busy || !stitch.ok} onClick={onStitch}>
                Stitch approved beats
              </button>
              {queue.stitch_error ? <p className="gen-err">{queue.stitch_error}</p> : null}
            </li>
          </ol>
        </div>
      )}
      {selected && selectedIndex > 0 ? (
        <div className="gen-beat-detail" aria-label={`Beat ${selectedIndex + 1} detail`}>
          <div className="gen-beat-detail-head">
            <p className="gen-label">Beat {selectedIndex + 1} detail</p>
            <span className={`gen-beat-status gen-beat-status-${selected.status}`}>{selected.status}</span>
          </div>
          <p className="gen-hint">Stills and the clip live here so the timeline stays a single row. Beat 1 stays in the form above.</p>
          <BeatStillFields beat={selected} index={selectedIndex} busy={busy} onPatch={onPatch} />
          {selected.error ? <p className="gen-err">{selected.error}</p> : null}
          {selected.job_id &&
          (selected.status === "ready" || selected.status === "approved" || selected.status === "rejected") ? (
            <GatedClip
              src={mediaSrc(selected.job_id, 0)}
              playbackRate={selected.slow_mo ? 0.5 : 1}
              label={
                selected.slow_mo
                  ? "0.5× slow-mo — remux after Wan when ffmpeg is on the runtime; otherwise playbackRate."
                  : undefined
              }
            />
          ) : (
            <p className="gen-hint">Generate this beat to preview the clip here.</p>
          )}
        </div>
      ) : null}
      {queue.beats.length === 0 ? (
        <div className="gen-beats-stitch">
          <button type="button" className="gen-go" disabled={busy || !stitch.ok} onClick={onStitch}>
            Stitch approved beats
          </button>
          {!stitch.ok && blockers[0] ? <p className="gen-hint">{blockers[0]}</p> : null}
        </div>
      ) : null}
      {queue.stitch_job_id ? (
        <div className="gen-beats-stitch-result">
          <p className="gen-label">Stitched cut</p>
          <GatedClip src={mediaSrc(queue.stitch_job_id, 0)} label="Stitched MP4 — simple concat on Vercel ffmpeg" />
        </div>
      ) : null}
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

export function cardToNewBeat(
  card: GenerateMotionCard | {
    source_image_url?: string;
    prompt?: string;
    negative_prompt?: string;
    end_image_url?: string;
    aspect?: MotionBeat["aspect"];
    seconds?: number;
    resolution?: MotionBeat["resolution"];
    audio?: boolean;
    seed?: number;
    slow_mo?: boolean;
  },
): MotionBeat {
  return emptyBeat({
    prompt: card.prompt,
    negative_prompt: card.negative_prompt,
    source_image_url: card.source_image_url,
    end_image_url: card.end_image_url,
    aspect: card.aspect,
    seconds: card.seconds,
    resolution: card.resolution,
    audio: card.audio === true,
    seed: card.seed,
    slow_mo: card.slow_mo === true,
  });
}
