"use client";

import { motionCost, usd } from "@/lib/generate-cost";
import { AdvancedOptions, WorkflowSection } from "./workflow";
import { FailureNotice } from "./recovery";

import {
  canStitchLongform,
  estimateLongform,
  failedHoldLongformBeats,
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
  autoAdvance,
  onAutoAdvance,
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
  onRunRemaining: () => void;
  autoAdvance: boolean;
  onAutoAdvance: (on: boolean) => void;
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
  const failedScene = failedHold[0];
  function reviewFailure() {
    if (!failedScene) return;
    onSelect(failedScene.id);
    const element = document.getElementById(`motion2-scene-${failedScene.id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.querySelector("textarea")?.focus({ preventScroll: true });
  }

  return (
    <div className="gen-longform" data-testid="motion2-longform">
      <WorkflowSection step={1}>
      <p className="gen-hint">Choose the image that starts your video. Add a scene plan below, one movement per line.</p>

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

      </WorkflowSection>
      <WorkflowSection step={2}>
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
        <label className="gen-check">
          <input
            type="checkbox"
            checked={autoAdvance}
            disabled={busy}
            data-testid="motion2-auto-advance"
            onChange={(e) => onAutoAdvance(e.target.checked)}
          />
          Automatically generate the next scene
        </label>
        <button type="button" className="gen-seed-random" disabled={primaryBusy} onClick={onPlan}>
          Plan {liveEstimate.beat_count} beats
        </button>
      </div>
      <p className="gen-hint">With automatic generation off, each click renders one scene. Turn it on only when you want to run the remaining sequence at the estimate shown.</p>
      {queue.beats.length > 0 && <p className="gen-ready" role="status">{queue.beats.length} scenes planned. Continue to Generate &amp; review to check your shots and start rendering.</p>}
      {notice && <p className="gen-hint" role="status">{notice}</p>}
      </WorkflowSection>
      <WorkflowSection step={3}>
      <div className="gen-row">
        <button
          type="button"
          className="gen-go"
          data-testid="motion2-go"
          disabled={generateLocked || primaryBusy || (!canGo && !inFlight.length)}
          onClick={onGo}
          style={{ marginLeft: "auto" }}
        >
          {primaryBusy ? "Working…" : failedHold.length ? "Sequence paused" : dryRun ? "Dry run" : (autoAdvance ? "Generate remaining clips" : "Generate next clip")}
        </button>
      </div>
      <p className="gen-hint">
        Clips generate in sequence, using the previous clip’s last frame. Review each one below before joining the final video.
      </p>
      {!queue.beats.length ? (
        <p className="gen-hint" data-testid="motion2-plan-first">
          Plan beats first. Go stays off until there is a draft beat to generate.
        </p>
      ) : failedHold.length ? (
        <p className="gen-hint">
          Review the failed scene below. Clear failure returns it to a draft; it does not skip or render the scene.
        </p>
      ) : !canGo && !primaryBusy ? (
        <p className="gen-hint">No beat is ready to generate. Plan a new take, or wait for the last frame.</p>
      ) : null}
      {stage ? (
        <p className="gen-stage" data-testid="motion2-stage">
          ⏳ {stage}
        </p>
      ) : null}
      {failedScene && <FailureNotice error={failedScene.error} scene={queue.beats.indexOf(failedScene) + 1} onReview={reviewFailure} testId="motion2-fail" />}
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
                id={`motion2-scene-${beat.id}`}
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
                  aria-label={`Scene ${i + 1} prompt`}
                  value={beat.prompt}
                  disabled={primaryBusy || beat.status === "generating"}
                  onChange={(e) => onPatch(beat.id, { prompt: e.target.value })}
                  onFocus={() => onSelect(beat.id)}
                />
                <AdvancedOptions title={`Scene ${i + 1} advanced options`} hint="Duration, resolution, seed, negative prompt and source image">
                  <div className="gen-card-grid">
                    <label>Seconds<input aria-label={`Scene ${i + 1} seconds`} type="number" min={2} max={30} value={beat.seconds} disabled={primaryBusy} onChange={e => onPatch(beat.id, { seconds: Math.min(30, Math.max(2, Number(e.target.value) || 2)) })} /></label>
                    <label>Resolution<select aria-label={`Scene ${i + 1} resolution`} value={beat.resolution} disabled={primaryBusy} onChange={e => onPatch(beat.id, { resolution: e.target.value as typeof beat.resolution })}><option value="720p">720p</option><option value="1080p">1080p</option></select></label>
                    <label>Seed<input aria-label={`Scene ${i + 1} seed`} type="number" min={0} max={2147483647} value={beat.seed} disabled={primaryBusy} onChange={e => onPatch(beat.id, { seed: Math.min(2147483647, Math.max(0, Math.trunc(Number(e.target.value) || 0))) })} /></label>
                  </div>
                  <label className="gen-field">Negative prompt<textarea aria-label={`Scene ${i + 1} negative prompt`} className="gen-box" rows={3} value={beat.negative_prompt} disabled={primaryBusy} onChange={e => onPatch(beat.id, { negative_prompt: e.target.value })} /></label>
                  <label className="gen-check"><input type="checkbox" checked={beat.from_prev_last} disabled={primaryBusy || i === 0} onChange={e => onPatch(beat.id, { from_prev_last: e.target.checked })} />Continue from the previous scene’s last frame</label>
                  <label className="gen-field">Starting image URL<input aria-label={`Scene ${i + 1} starting image`} value={beat.source_image_url} disabled={primaryBusy || beat.from_prev_last} onChange={e => onPatch(beat.id, { source_image_url: e.target.value })} /></label>
                </AdvancedOptions>
                {beat.error && <FailureNotice error={beat.error} testId={`motion2-beat-error-${i + 1}`} />}
                {beat.job_id && (beat.status === "ready" || beat.status === "approved") ? (
                  <GatedClip src={mediaSrc(beat.job_id, 0)} />
                ) : null}
                <p className="gen-hint">Internal cost: ~{usd(motionCost("wan30-i2v", beat.seconds, beat.resolution))} per {beat.seconds}s generation / retry · {beat.resolution}</p>
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
                        Clear failure
                      </button>
                      <button
                        type="button"
                        className="gen-seed-random"
                        data-testid={`motion2-beat-retry-${i + 1}`}
                        disabled={primaryBusy}
                        onClick={() => onRetry(beat.id)}
                      >
                        Retry scene
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

          </p>
        )}
        {queue.stitch_error ? <p className="gen-err">{queue.stitch_error}</p> : null}
        {queue.stitch_job_id ? (
          <div className="gen-beats-stitch-result">
            <GatedClip src={mediaSrc(queue.stitch_job_id, 0)} />
          </div>
        ) : null}
      </div>
      </WorkflowSection>
    </div>
  );
}
