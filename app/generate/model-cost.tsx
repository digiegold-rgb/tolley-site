"use client";

import { useState } from "react";
import type { WorkflowMode } from "@/lib/generate-workflow";
import type { GenerateJobCard } from "@/lib/generate-job-card";
import type { GenerateMotionCard } from "@/lib/generate-motion-card";
import type { BeatQueue } from "@/lib/generate-beats";
import type { LongformQueue } from "@/lib/generate-longform";
import { clampCinemaSeconds, estimateCinema, type CinemaQueue } from "@/lib/generate-cinema";
import { COST_CHECKED, COST_SOURCES, cinemaClipCost, costRange, imageCost, modalCost, motionCost, usd } from "@/lib/generate-cost";

export function ModelCostPanel({ mode, model, onModel, disabled, dryRun, seconds, aspect, card, motion, beats, longform, cinema }: {
  mode: WorkflowMode; model: string; onModel: (model: string) => void; disabled: boolean; dryRun: boolean;
  seconds: number; aspect: "9:16" | "16:9" | "1:1"; card: GenerateJobCard; motion: GenerateMotionCard;
  beats: BeatQueue; longform: LongformQueue; cinema: CinemaQueue;
}) {
  const [minutes, setMinutes] = useState(5);
  let options: { id: string; label: string; price: string }[] = [];
  let low = 0, high: number | undefined, total: number | undefined, totalHigh: number | undefined;
  let unit = "per video generation", note = "", source: string = COST_SOURCES.wan;
  if (mode === "t2i") {
    options = [{ id: "flux-dev", label: "FLUX.1 Dev", price: usd(imageCost("flux-dev", aspect)) }, { id: "flux-schnell", label: "FLUX.1 Schnell", price: usd(imageCost("flux-schnell", aspect)) }];
    low = imageCost(model, aspect); unit = "per image generation";
    note = "One image per call. Image dimensions round up to 2 billable megapixels.";
    source = model === "flux-schnell" ? COST_SOURCES.schnell : COST_SOURCES.flux;
  } else if (mode === "modal") {
    low = modalCost(minutes, 1); total = modalCost(minutes, card.num_images); unit = "per image · runtime assumption";
    options = [{ id: "qwen", label: "Qwen Image Edit · Modal", price: usd(low) }];
    note = `For ${card.width} × ${card.height}, ${card.num_inference_steps} steps: enter expected billable minutes per image, including startup. This is a budget assumption, not a measured runtime. Batch time and actual resource use can differ. Only Qwen is connected for this character workflow.`;
    source = COST_SOURCES.modal;
  } else if (mode === "cinema") {
    const next = cinema.beats.find(b => b.status === "draft" || b.status === "rejected");
    const duration = next?.seconds ?? 10;
    const quote = (m: string) => cinemaClipCost({ model: m, seconds: clampCinemaSeconds(duration, 10, m === "kling" ? "kling" : "seedance"), audio: next?.generate_audio ?? cinema.generate_audio, resolution: cinema.resolution, videoInput: Boolean(next?.video_ref_url || cinema.prior_video_url || (next && cinema.pass_prev_video && cinema.beats.indexOf(next) > 0)) });
    options = ["seedance", "kling"].map(id => { const p = quote(id); return { id, label: id === "seedance" ? "Seedance 2.0" : "Kling 3 Pro", price: costRange(p.low, p.high) }; });
    const p = quote(model); low = p.low; high = p.high; unit = `per ${duration}s shot generation`;
    const remaining = estimateCinema(cinema); total = remaining.usd; totalHigh = remaining.usd_high;
    note = `${remaining.fal_calls} shots ready to generate. ${remaining.note} Changing model applies to future submissions; existing clips keep their original model.`;
    source = model === "kling" ? COST_SOURCES.kling : COST_SOURCES.seedance;
  } else if (mode === "motion2") {
    const next = longform.beats.find(b => b.status === "draft" || b.status === "rejected");
    low = motionCost("wan30-i2v", next?.seconds ?? longform.beat_seconds, next?.resolution);
    options = [{ id: "wan30-i2v", label: "Wan 3.0 · Longform", price: usd(low) }];
    total = longform.beats.length ? longform.beats.filter(b => b.status === "draft" || (b.status === "rejected" && !b.error)).reduce((s, b) => s + motionCost("wan30-i2v", b.seconds, b.resolution), 0) : motionCost("wan30-i2v", longform.target_seconds);
    unit = `per ${next?.seconds ?? longform.beat_seconds}s scene generation`;
    note = `${longform.beats.length ? "Remaining scenes, using each scene’s resolution." : "Planned target at 720p; plan scenes to refine this estimate."} Wan 3.0 is the connected model for 2–30s scenes. Cinema offers Seedance and Kling for shorter shots.`;
    source = COST_SOURCES.wan30;
  } else {
    const length = mode === "motion" ? motion.seconds : seconds;
    const resolution = mode === "motion" ? motion.resolution : "720p";
    const wan3 = mode === "t2v" ? "wan30-t2v" : "wan30-i2v";
    const legacy = mode === "t2v" ? "wan26-720p" : "wan-legacy";
    options = [{ id: legacy, label: "Wan 2.1 · legacy", price: "$0.40" }, { id: wan3, label: "Wan 3.0", price: usd(motionCost(wan3, length, resolution)) }];
    low = motionCost(model, length, resolution);
    note = model === legacy ? "Flat $0.40 per 720p call (up to 81 frames). Shorter duration and slow motion do not lower the provider charge." : `Duration-based cost at ${resolution}. Slow motion changes playback, not generated seconds.`;
    if (mode === "motion") {
      total = beats.beats.length ? beats.beats.filter(b => b.status === "draft" || b.status === "rejected").reduce((s, b) => s + motionCost(b.model, b.seconds, b.resolution), 0) : low;
      note += " This selector changes Beat 1. Other beats have their own model selector.";
    }
    source = model === wan3 ? mode === "t2v" ? COST_SOURCES.wan30Text : COST_SOURCES.wan30 : mode === "t2v" ? COST_SOURCES.wanText : COST_SOURCES.wan;
  }
  if (mode === "v2v") return null;
  return <section className="gen-model-cost" aria-label="Model and internal cost" data-testid="model-cost">
    <div className="gen-model-cost-top">
      <label className="gen-field">Generation model
        <select aria-label="Generation model" data-testid={mode === "cinema" ? "cinema-model" : "generation-model"} value={model} disabled={disabled || options.length < 2} onChange={e => onModel(e.target.value)}>
          {options.map(o => <option key={o.id} value={o.id}>{o.label} · ~{o.price} / generation</option>)}
        </select>
      </label>
      <div aria-live="polite" aria-atomic="true"><span className="gen-micro">Estimated internal cost · USD</span><strong className="gen-cost-number">~{costRange(low, high)}</strong><span>{unit}</span></div>
      {total != null && <div aria-live="polite"><span className="gen-micro">{mode === "modal" ? `${card.num_images} image batch` : "Remaining sequence"}</span><strong className="gen-cost-number">~{costRange(total, totalHigh)}</strong></div>}
    </div>
    {mode === "modal" && <label className="gen-field">Assumed compute minutes per image<input aria-label="Assumed compute minutes per image" type="number" min="0.1" max="20" step="0.1" value={minutes} onChange={e => setMinutes(Math.min(20, Math.max(0.1, Number(e.target.value) || 0.1)))} /></label>}
    <p className="gen-hint">{note}</p>
    {dryRun && <p className="gen-ready">Dry run: $0 generation spend. Estimates above apply when you turn test mode off.</p>}
    <details><summary>What this estimate includes</summary><p className="gen-hint">Provider generation cost before credits or discounts; no retail markup. Excludes director chat, storage, uploads, and video processing. Each regenerate or retry is another provider request. Estimates are not an invoice. Rates checked {COST_CHECKED}. <a href={source} target="_blank" rel="noreferrer">Provider pricing ↗</a></p></details>
  </section>;
}
