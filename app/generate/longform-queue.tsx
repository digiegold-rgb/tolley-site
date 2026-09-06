"use client";

import {
  canStitchLongform,
  estimateLongform,
  failedHoldLongformBeats,
  formatLongformFalError,
  inFlightLongformBeats,
  longformProgress,
  longformStitchBlockers,
  motion2GenerateLocked,
  type LongformBeat,
  type LongformEstimate,
  type LongformQueue,
} from "@/lib/generate-longform";
import { DurationChips, GatedClip, wan30PriceHint } from "./beat-queue";

function mediaSrc(jobId: string, index = 0): string {
  return `/api/generate/jobs/${encodeURIComponent(jobId)}/image?i=${index}`;
}

function stillLooksUsable(url: string): boolean {
  const u = url.trim();
  return /^https:\/\//i.test(u) || /^\/api\/generate\/jobs\/[^/]+\/image\?i=\d+$/.test(u);
}

export function LongformPanel({
  queue,
  estimate,
  busy,
  selectedId,
  dryRun,
  ripple,
  uploadingStill,
  onSelect,
  onSourceChange,
  onUploadStill,
  onTargetSeconds,
  onBeatSeconds,
  onScript,
  onEndStill,
  onDryRun,
  onRipple,
  onPlan,
  onPatch,
  onGenerate,
  onGo,
  canGo,
  notice,
  stage,
  onApprove,
  onReject,
  onReset,
  onDismiss,
  onRetry,
  onStitch,
}: {
  queue: LongformQueue;
  estimate?: LongformEstimate | null;
  busy: boolean;
  selectedId?: string | null;
  dryRun: boolean;
  ripple: boolean;
  uploadingStill?: boolean;
  onSelect: (id: string) => void;
  onSourceChange: (url: string) => void;
  onUploadStill: (file: File) => void;
  onTargetSeconds: (seconds: number) => void;
  onBeatSeconds: (seconds: number) => void;
  onScript: (script: string) => void;
  onEndStill: (url: string) => void;
  onDryRun: (on: boolean) => void;
  onRipple: (on: boolean) => void;
  onPlan: () => void;
  onPatch: (id: string, patch: Partial<LongformBeat>) => void;
  onGenerate: (id: string) => void;
  onGo: () => void;
  canGo: boolean;
  notice?: string | null;
  stage?: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReset: (id: string) => void;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
  onStitch: () => void;
}) {
  const liveEstimate =
    estimate ||
    estimateLongform({
      targetSeconds: queue.target_seconds,
      beatSeconds: queue.beat_seconds,
      script: queue.script,
    });
  const progress = longformProgress(queue);
  const stitchOk = canStitchLongform(queue);
  const selected = queue.beats.find((b) => b.id === selectedId) || queue.beats[0] || null;
  const selectedIndex = selected ? queue.beats.findIndex((b) => b.id === selected.id) : -1;
  const inFlight = inFlightLongformBeats(queue);
  const inFlightIds = new Set(inFlight.map((b) => b.id));
  const failedHold = failedHoldLongformBeats(queue);
  const failedHoldIds = new Set(failedHold.map((b) => b.id));
  const generateLocked = motion2GenerateLocked(queue);
  const primaryBusy = busy || inFlight.length > 0;
  const failBanner = failedHold[0]
    ? formatLongformFalError(failedHold[0].error) +
      (failedHold[0].job_id ? ` · beat ${failedHold[0].job_id}` : "")
    : null;

  return (
    <div className="gen-longform" data-testid="motion2-longform">
      <p className="gen-hint">
        <strong>Motion 2 · Longform</strong> — a continuous ~3-minute take from a keep still +
        scene plan. Wan 3.0 segments are <strong>5 / 15 / 30s</strong> (default 15s →{" "}
        {liveEstimate.beat_count}×{liveEstimate.beat_seconds}s ≈ {liveEstimate.planned_seconds}s).
        After each beat, ffmpeg extracts the last frame and that PNG becomes the next beat’s first
        frame. Review / regenerate bad beats, then stitch. This is <em>not</em> one native 3-min Wan
        call, and it is not the Motion 1 filmstrip.
      </p>

      <label className="gen-field gen-field-wide">
        Keep still (gallery still, HTTPS URL, or upload)
        <input
          value={queue.source_image_url}
          disabled={busy}
          placeholder="Use as source on a Modal still, or paste https://…"
          onChange={(e) => onSourceChange(e.target.value)}
        />
        <span className="gen-file">
          Upload still:{" "}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || uploadingStill}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadStill(f);
            }}
          />
          {uploadingStill && <span> uploading…</span>}
        </span>
      </label>
      {stillLooksUsable(queue.source_image_url) && (
        <div className="gen-still-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={queue.source_image_url} alt="Keep still" />
        </div>
      )}

      <div className="gen-card-grid">
        <label>
          Segment length
          <DurationChips seconds={queue.beat_seconds} disabled={busy} onPick={onBeatSeconds} />
          <span className="gen-hint">{wan30PriceHint(queue.beat_seconds)} per beat</span>
        </label>
        <label>
          Target duration
          <input
            type="range"
            min={15}
            max={300}
            step={5}
            value={queue.target_seconds}
            disabled={busy}
            onChange={(e) => onTargetSeconds(Number(e.target.value))}
          />
          <span className="gen-hint">
            {queue.target_seconds}s → {liveEstimate.beat_count} × {liveEstimate.beat_seconds}s beats
            · default 180s / 3 min
          </span>
        </label>
        <label className="gen-field gen-field-wide">
          Optional end still / FLF2V (applied to every beat if set)
          <input
            value={queue.end_image_url}
            disabled={busy}
            placeholder="Optional pose still. Leave empty for I2V + last-frame chain."
            onChange={(e) => onEndStill(e.target.value)}
          />
        </label>
      </div>

      <div>
        <p className="gen-label gen-label-live">Scene plan (one motion prompt per line)</p>
        <p className="gen-hint">
          Empty = duplicate Beat 1 / default identity-lock prompt across all beats. Extra lines
          raise beat count above the duration floor.
        </p>
        <textarea
          data-testid="motion2-script"
          className="gen-box gen-box-inference"
          value={queue.script}
          disabled={busy}
          rows={6}
          placeholder={"she turns toward camera, hair moves\nshe walks to the stairs\nshe looks back and smiles"}
          onChange={(e) => onScript(e.target.value)}
        />
      </div>

      <div className="gen-longform-estimate" data-testid="motion2-estimate">
        <p>
          <strong>Dry-run estimate:</strong> {liveEstimate.fal_calls} fal Wan 3.0 I2V calls ·{" "}
          {liveEstimate.planned_seconds}s planned. {liveEstimate.note}
        </p>
      </div>

      <div className="gen-row">
        <label className="gen-check">
          <input
            type="checkbox"
            checked={dryRun}
            disabled={busy}
            onChange={(e) => onDryRun(e.target.checked)}
          />
          Dry run (no GPU)
        </label>
        <label className="gen-check">
          <input
            type="checkbox"
            checked={ripple}
            disabled={busy}
            onChange={(e) => onRipple(e.target.checked)}
          />
          Ripple continuity on regenerate
        </label>
        <button type="button" className="gen-seed-random" disabled={primaryBusy} onClick={onPlan}>
          Plan {liveEstimate.beat_count} beats
        </button>
        <button
          type="button"
          className="gen-go"
          data-testid="motion2-go"
          disabled={generateLocked || primaryBusy || (!canGo && !inFlight.length)}
          onClick={onGo}
          style={{ marginLeft: "auto" }}
        >
          {primaryBusy ? "Working…" : failedHold.length ? "Failed" : dryRun ? "Dry run" : "Go"}
        </button>
      </div>
      {!queue.beats.length ? (
        <p className="gen-hint" data-testid="motion2-plan-first">
          Plan beats first. Go stays off until there is a draft beat to generate.
        </p>
      ) : failedHold.length ? (
        <p className="gen-hint">Generate stays off until you dismiss or retry the failed beat.</p>
      ) : !canGo && !primaryBusy ? (
        <p className="gen-hint">No beat is ready to generate. Plan a new take, or wait for the last frame.</p>
      ) : null}
      {stage ? (
        <p className="gen-stage" data-testid="motion2-stage">
          ⏳ {stage}
        </p>
      ) : null}
      {failBanner ? (
        <p className="gen-longform-fail" data-testid="motion2-fail" role="alert">
          {failBanner}
        </p>
      ) : null}
      {notice ? <p className="gen-library-status" data-testid="motion2-notice">{notice}</p> : null}

      {queue.continuity_error ? <p className="gen-err">{queue.continuity_error}</p> : null}

      {queue.beats.length > 0 && (
        <div className="gen-longform-review">
          <div className="gen-longform-head">
            <p className="gen-label">Review beats</p>
            <p className="gen-hint">
              {progress.ready}/{progress.total} ready · {progress.approved} approved
              {progress.generating ? " · generating" : ""}
            </p>
          </div>
          <ol className="gen-longform-list" aria-label="Longform beat review">
            {queue.beats.map((beat, i) => (
              <li
                key={beat.id}
                className={`gen-longform-beat${selected?.id === beat.id ? " gen-longform-beat-on" : ""}`}
              >
                <button
                  type="button"
                  className="gen-longform-select"
                  onClick={() => onSelect(beat.id)}
                >
                  <span className="gen-longform-num">Beat {i + 1}</span>
                  <span className={`gen-beat-status gen-beat-status-${beat.status}`}>
                    {failedHoldIds.has(beat.id) ? "failed" : beat.status}
                  </span>
                  <span className="gen-longform-meta">
                    {i === 0
                      ? "keep still"
                      : beat.from_prev_last
                        ? "last frame of previous"
                        : "custom still"}
                    {beat.last_frame_url ? " · last frame extracted" : ""}
                  </span>
                </button>
                <textarea
                  className="gen-longform-prompt"
                  value={beat.prompt}
                  disabled={primaryBusy || beat.status === "generating"}
                  onChange={(e) => onPatch(beat.id, { prompt: e.target.value })}
                  onFocus={() => onSelect(beat.id)}
                />
                {beat.error ? (
                  <p className="gen-err" data-testid={`motion2-beat-error-${i + 1}`}>
                    {formatLongformFalError(beat.error)}
                  </p>
                ) : null}
                {beat.job_id && (beat.status === "ready" || beat.status === "approved") ? (
                  <GatedClip src={mediaSrc(beat.job_id, 0)} />
                ) : null}
                <div className="gen-beat-actions">
                  {failedHoldIds.has(beat.id) ? (
                    <>
                      <button
                        type="button"
                        className="gen-seed-random"
                        data-testid={`motion2-beat-dismiss-${i + 1}`}
                        disabled={primaryBusy}
                        onClick={() => onDismiss(beat.id)}
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        className="gen-seed-random"
                        data-testid={`motion2-beat-retry-${i + 1}`}
                        disabled={primaryBusy}
                        onClick={() => onRetry(beat.id)}
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="gen-seed-random"
                      data-testid={`motion2-beat-generate-${i + 1}`}
                      disabled={primaryBusy || generateLocked || inFlightIds.has(beat.id)}
                      onClick={() => onGenerate(beat.id)}
                    >
                      {inFlightIds.has(beat.id)
                        ? beat.job_id
                          ? `Generating… ${beat.job_id}`
                          : "Generating…"
                        : beat.status === "draft"
                          ? "Generate this beat"
                          : "Regenerate"}
                    </button>
                  )}
                  {beat.status === "ready" || (beat.status === "rejected" && !beat.error) ? (
                    <button
                      type="button"
                      className="gen-seed-random"
                      disabled={busy}
                      onClick={() => onApprove(beat.id)}
                    >
                      Approve
                    </button>
                  ) : null}
                  {beat.status === "ready" || beat.status === "approved" ? (
                    <button
                      type="button"
                      className="gen-seed-random"
                      disabled={busy}
                      onClick={() => onReject(beat.id)}
                    >
                      Reject
                    </button>
                  ) : null}
                  {beat.status === "approved" ? (
                    <button
                      type="button"
                      className="gen-seed-random"
                      disabled={busy}
                      onClick={() => onReset(beat.id)}
                    >
                      Unapprove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {selected && selectedIndex > 0 && stillLooksUsable(selected.source_image_url) && (
        <div className="gen-still-preview">
          <p className="gen-hint">Beat {selectedIndex + 1} source (last frame of previous when chained)</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.source_image_url} alt="Continuity still" />
        </div>
      )}

      <div className="gen-longform-stitch">
        {stitchOk.ok ? (
          <button type="button" className="gen-go" disabled={busy} onClick={onStitch}>
            Stitch approved beats
          </button>
        ) : (
          <p className="gen-hint">
            Stitch waits until every beat is approved.
            {longformStitchBlockers(queue)[0] ? ` ${longformStitchBlockers(queue)[0]}.` : ""}
            {" "}Concat is ffmpeg concat-demuxer (stream copy) on Vercel Node — not Spark.
          </p>
        )}
        {queue.stitch_error ? <p className="gen-err">{queue.stitch_error}</p> : null}
        {queue.stitch_job_id ? (
          <div className="gen-beats-stitch-result">
            <GatedClip src={mediaSrc(queue.stitch_job_id, 0)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
