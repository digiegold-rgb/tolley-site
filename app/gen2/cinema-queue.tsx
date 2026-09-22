"use client";

import { cinemaClipCost, costRange } from "@/lib/generate-cost";
import { AdvancedOptions, WorkflowSection } from "./workflow";
import { FailureNotice } from "./recovery";

import {
  CINEMA_SECONDS_DEFAULT,
  canStitchCinema,
  cinemaProgress,
  cinemaSecondsChips,
  cinemaStitchBlockers,
  cinemaGenerateLocked,
  clampCinemaSeconds,
  estimateCinema,
  failedHoldCinemaBeats,
  inFlightCinemaBeats,
  type CinemaBeat,
  type CinemaEstimate,
  type CinemaModel,
  type CinemaQueue,
} from "@/lib/generate-cinema";
import { GatedClip } from "./beat-queue";

function CinemaSecondsChips({
  seconds,
  model,
  disabled,
  onPick,
}: {
  seconds: number;
  model: CinemaModel;
  disabled?: boolean;
  onPick: (seconds: number) => void;
}) {
  const chips = cinemaSecondsChips(model);
  const shown = chips.includes(seconds) ? chips : [...chips, seconds].sort((a, b) => a - b);
  return (
    <div className="gen-nsfw-chips" role="group" aria-label="Beat length" data-testid="cinema-seconds-chips">
      {shown.map((n) => (
        <button
          key={n}
          type="button"
          className={`gen-nsfw-chip${seconds === n ? " gen-nsfw-chip-on" : ""}`}
          disabled={disabled}
          aria-pressed={seconds === n}
          onClick={() => onPick(clampCinemaSeconds(n, CINEMA_SECONDS_DEFAULT, model))}
        >
          {n === 15 ? "15s max" : `${n}s`}
        </button>
      ))}
    </div>
  );
}

function mediaSrc(jobId: string, index = 0): string {
  return `/api/generate/jobs/${encodeURIComponent(jobId)}/image?i=${index}`;
}

export function CinemaPanel({
  queue,
  estimate,
  busy,
  selectedId,
  dryRun,
  uploadingRef,
  onSelect,
  onImageUrls,
  onAudioUrl,
  onPriorVideo,
  onScript,
  onGenerateAudio,
  onPassPrevVideo,
  onAutoAdvance,
  onDryRun,
  onPlan,
  onLoadEstate,
  onPatch,
  onGenerate,
  onRunRemaining,
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
  queue: CinemaQueue;
  estimate?: CinemaEstimate | null;
  busy: boolean;
  selectedId?: string | null;
  dryRun: boolean;
  uploadingRef?: boolean;
  onSelect: (id: string) => void;
  onImageUrls: (urls: string[]) => void;
  onAudioUrl: (url: string) => void;
  onPriorVideo: (url: string) => void;
  onScript: (script: string) => void;
  onModel: (model: CinemaModel) => void;
  onGenerateAudio: (on: boolean) => void;
  onPassPrevVideo: (on: boolean) => void;
  onAutoAdvance: (on: boolean) => void;
  onDryRun: (on: boolean) => void;
  onPlan: () => void;
  onLoadEstate: () => void;
  onPatch: (id: string, patch: Partial<CinemaBeat>) => void;
  onGenerate: (id: string) => void;
  onGo: () => void;
  onRunRemaining: () => void;
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
  const liveEstimate = estimateCinema(queue);
  void estimate;
  const progress = cinemaProgress(queue);
  const stitchOk = canStitchCinema(queue);
  const selected = queue.beats.find((b) => b.id === selectedId) || queue.beats[0] || null;
  const inFlight = inFlightCinemaBeats(queue);
  const inFlightIds = new Set(inFlight.map((b) => b.id));
  const failedHold = failedHoldCinemaBeats(queue);
  const failedHoldIds = new Set(failedHold.map((b) => b.id));
  const generateLocked = cinemaGenerateLocked(queue);
  const primaryBusy = busy || inFlight.length > 0;
  const failedScene = failedHold[0];
  function reviewFailure() {
    if (!failedScene) return;
    onSelect(failedScene.id);
    const element = document.getElementById(`cinema-scene-${failedScene.id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.querySelector("textarea")?.focus({ preventScroll: true });
  }

  return (
    <div className="gen-longform" data-testid="cinema-lane">
      <WorkflowSection step={1}>
      <p className="gen-hint">Add references for the people, place, and visual style. Write one shot per line, or load the estate template.</p>

      <button
        type="button"
        className="gen-seed-random"
        data-testid="cinema-load-estate"
        disabled={primaryBusy}
        onClick={onLoadEstate}
      >
        Load estate proof template
      </button>

      <label className="gen-field gen-field-wide">
        Identity / ref image URLs (up to 9, one per line). @Image1 full body, @Image2 bust, @Image3
        identity.
        <textarea
          data-testid="cinema-image-urls"
          className="gen-box"
          rows={4}
          value={queue.image_urls.join("\n")}
          disabled={busy}
          placeholder={"https://…/estate-a/front.png\nhttps://…/bust.png\nhttps://…/identity/front.jpg"}
          onChange={(e) =>
            onImageUrls(
              e.target.value
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 9),
            )
          }
        />
        {uploadingRef && <span className="gen-hint"> uploading…</span>}
      </label>

      <div>
        <p className="gen-label gen-label-live">Script (one beat per line) or paste shotlist JSON</p>
        <p className="gen-hint">
          Short VO lines become <code>She says exactly: &quot;…&quot;</code> scaffolds. Import a shotlist JSON
          with id / seconds / vo / prompt.
        </p>
        <textarea
          data-testid="cinema-script"
          className="gen-box gen-box-inference"
          value={queue.script}
          disabled={busy}
          rows={8}
          placeholder={'Welcome to the estate.\nThe approach is the first promise.'}
          onChange={(e) => onScript(e.target.value)}
        />
      </div>

      </WorkflowSection>
      <WorkflowSection step={2}>
      <AdvancedOptions hint="Optional audio track and previous-video reference">
      <div className="gen-card-grid">
        <label className="gen-field">
          Optional @Audio1 URL
          <input
            value={queue.audio_url}
            disabled={busy}
            placeholder="https://…/voice.mp3"
            onChange={(e) => onAudioUrl(e.target.value)}
          />
        </label>
        <label className="gen-field">
          Optional prior @Video URL
          <input
            value={queue.prior_video_url}
            disabled={busy}
            placeholder="Previous clip MP4 for continuity"
            onChange={(e) => onPriorVideo(e.target.value)}
          />
        </label>

      </div>
      </AdvancedOptions>
      <p className="gen-hint" data-testid="cinema-seconds-limit">
        Max 15s per beat (fal hard limit). Stitch beats for longer.
        {queue.model === "kling" ? " Kling allows 3–15s." : " Seedance allows 4–15s."} Default 10s.
      </p>

      <div className="gen-longform-estimate" data-testid="cinema-estimate">
        <p>
          <strong>Estimate:</strong> {liveEstimate.fal_calls} remaining fal calls ·{" "}
          {liveEstimate.planned_seconds}s · ~${liveEstimate.usd.toFixed(2)}
          {liveEstimate.usd_high != null ? `–$${liveEstimate.usd_high.toFixed(2)}` : ""}{" "}
          {queue.model === "kling" ? "Kling Pro" : `@${queue.resolution}`}. {liveEstimate.note}
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
            checked={queue.generate_audio}
            disabled={busy}
            onChange={(e) => onGenerateAudio(e.target.checked)}
          />
          Native audio
        </label>
        <label className="gen-check">
          <input
            type="checkbox"
            checked={queue.pass_prev_video}
            disabled={busy}
            onChange={(e) => onPassPrevVideo(e.target.checked)}
          />
          Pass previous clip as @Video
        </label>
        <label className="gen-check">
          <input
            type="checkbox"
            checked={queue.auto_advance}
            disabled={busy}
            data-testid="cinema-auto-advance"
            onChange={(e) => onAutoAdvance(e.target.checked)}
          />
          Automatically generate the next scene
        </label>
        <button type="button" className="gen-seed-random" disabled={primaryBusy} onClick={onPlan}>
          Plan beats
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
          data-testid="cinema-go"
          disabled={generateLocked || primaryBusy || (!canGo && !inFlight.length)}
          onClick={onRunRemaining}
          style={{ marginLeft: "auto" }}
        >
          {primaryBusy ? "Working…" : failedHold.length ? "Sequence paused" : dryRun ? "Dry run" : (queue.auto_advance ? "Generate remaining clips" : "Generate next clip")}
        </button>
      </div>
      <p className="gen-hint">
        Shots generate in sequence. Review and approve each shot below, then join your finished film.
      </p>
      {!queue.beats.length ? (
        <p className="gen-hint" data-testid="cinema-plan-first">
          Plan beats or load the estate proof template first.
        </p>
      ) : failedHold.length ? (
        <p className="gen-hint">Review the failed scene below. Clear failure returns it to a draft; it does not skip or render the scene.</p>
      ) : null}
      {stage ? (
        <p className="gen-stage" data-testid="cinema-stage">
          ⏳ {stage}
        </p>
      ) : null}
      {failedScene && <FailureNotice error={failedScene.error} scene={queue.beats.indexOf(failedScene) + 1} onReview={reviewFailure} testId="cinema-fail" />}
      {notice ? <p className="gen-library-status" data-testid="cinema-notice">{notice}</p> : null}

      {queue.beats.length > 0 && (
        <div className="gen-longform-review">
          <div className="gen-longform-head">
            <p className="gen-label">Review beats</p>
            <p className="gen-hint">
              {progress.ready}/{progress.total} ready · {progress.approved} approved
              {progress.generating ? " · generating" : ""}
            </p>
          </div>
          <ol className="gen-longform-list" aria-label="Cinema beat review">
            {queue.beats.map((beat, i) => (
              <li
                key={beat.id}
                id={`cinema-scene-${beat.id}`}
                className={`gen-longform-beat${selected?.id === beat.id ? " gen-longform-beat-on" : ""}`}
              >
                <button type="button" className="gen-longform-select" onClick={() => onSelect(beat.id)}>
                  <span className="gen-longform-num">
                    {beat.id.startsWith("c0") ? beat.id.toUpperCase() : `Beat ${i + 1}`}
                  </span>
                  <span className={`gen-beat-status gen-beat-status-${beat.status}`}>
                    {failedHoldIds.has(beat.id) ? "failed" : beat.status}
                  </span>
                  <span className="gen-longform-meta">
                    {beat.seconds}s · {beat.generate_audio ? "audio on" : "silent"} · ~{(() => { const p = cinemaClipCost({ model: queue.model, seconds: beat.seconds, audio: beat.generate_audio, resolution: queue.resolution, videoInput: Boolean(beat.video_ref_url || queue.prior_video_url || (queue.pass_prev_video && queue.beats.indexOf(beat) > 0)) }); return costRange(p.low, p.high); })()} per generation
                    {beat.video_ref_url ? " · prior clip" : ""}
                  </span>
                </button>
                <CinemaSecondsChips
                  seconds={beat.seconds}
                  model={queue.model}
                  disabled={primaryBusy || beat.status === "generating"}
                  onPick={(n) => onPatch(beat.id, { seconds: n })}
                />
                {beat.vo_line ? <p className="gen-hint">VO: {beat.vo_line}</p> : null}
                <textarea
                  className="gen-longform-prompt"
                  aria-label={`Scene ${i + 1} prompt`}
                  value={beat.prompt}
                  disabled={primaryBusy || beat.status === "generating"}
                  onChange={(e) => onPatch(beat.id, { prompt: e.target.value })}
                  onFocus={() => onSelect(beat.id)}
                />
                <label className="gen-check">
                  <input
                    type="checkbox"
                    checked={beat.generate_audio}
                    disabled={primaryBusy || beat.status === "generating"}
                    onChange={(e) => onPatch(beat.id, { generate_audio: e.target.checked })}
                  />
                  Include generated audio
                </label>
                <AdvancedOptions title={`Scene ${i + 1} advanced options`} hint="Negative prompt and previous-video reference">
                  <label className="gen-field">Negative prompt<textarea aria-label={`Scene ${i + 1} negative prompt`} className="gen-box" rows={3} value={beat.negative_prompt} disabled={primaryBusy} onChange={e => onPatch(beat.id, { negative_prompt: e.target.value })} /></label>
                  <label className="gen-field">Previous video reference<input aria-label={`Scene ${i + 1} video reference`} value={beat.video_ref_url} disabled={primaryBusy} onChange={e => onPatch(beat.id, { video_ref_url: e.target.value })} /></label>
                </AdvancedOptions>
                {beat.error && <FailureNotice error={beat.error} testId={`cinema-beat-error-${i + 1}`} />}
                {beat.job_id && (beat.status === "ready" || beat.status === "approved") ? (
                  <GatedClip src={mediaSrc(beat.job_id, 0)} />
                ) : null}
                <div className="gen-beat-actions">
                  {failedHoldIds.has(beat.id) ? (
                    <>
                      <button
                        type="button"
                        className="gen-seed-random"
                        data-testid={`cinema-beat-dismiss-${i + 1}`}
                        disabled={primaryBusy}
                        onClick={() => onDismiss(beat.id)}
                      >
                        Clear failure
                      </button>
                      <button
                        type="button"
                        className="gen-seed-random"
                        data-testid={`cinema-beat-retry-${i + 1}`}
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
                      data-testid={`cinema-beat-generate-${i + 1}`}
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

      <div className="gen-longform-stitch">
        {stitchOk.ok ? (
          <button type="button" className="gen-go" disabled={busy} onClick={onStitch}>
            Stitch approved beats
          </button>
        ) : (
          <p className="gen-hint">
            Stitch waits until every beat is approved.
            {cinemaStitchBlockers(queue)[0] ? ` ${cinemaStitchBlockers(queue)[0]}.` : ""}
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
