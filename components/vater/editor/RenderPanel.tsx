"use client";

/**
 * RenderPanel — THE control surface of the scene editor (2026-08-26, Jared:
 * "merge the purple box into the top… all the options in one panel").
 *
 * One row of dropdowns decides everything a paid click will do:
 *   Scope   — this scene / selected / scenes without a clip / all
 *   Engine  — every customer tier, grouped, price + time on the line
 *   Motion  — amount + end-on-start-pose (only for engines that honor them)
 *   Camera  — lock / free
 *   Prompt  — "what moves", for a single scene (AI writes it when blank)
 * …then a plain-English sentence says exactly what will happen and what it
 * costs, and the buttons repeat the price. Presentational only — EditorShell
 * owns the money, the confirm modal and the network.
 */
import {
  ANIMATION_PRICES,
  ANIMATION_TIER_GROUPS,
  CUSTOMER_ANIMATION_TIERS,
  FLAT_ACTION_PRICES,
  formatPrice,
  type AnimationTierGroup,
} from "@/lib/vater/pricing";
import type { AnimationQuality, MotionIntensity } from "@/lib/vater/video-spec";
import { useEffect, useState } from "react";

/** Live "something is running" state. `startedAt` = Date.now() at kickoff. */
export type RunStatus = {
  label: string;        // "Animating scene 1 with Kling Standard 720p"
  startedAt: number;
  etaLabel: string;     // "~2 min" per unit
  step: number;         // 1-based unit in progress
  total: number;
  detail?: string | null; // last log line, if any
};

/** "~2 min" → 120, "~90 s" → 90, "~15-20 min" → 1050 (midpoint). */
export function etaSeconds(label: string): number {
  const m = label.match(/(\d+)(?:\s*-\s*(\d+))?\s*(min|s)\b/i);
  if (!m) return 120;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const v = (a + b) / 2;
  return m[3].toLowerCase() === "min" ? v * 60 : v;
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MotionPlanCard({
  sheet,
  planning,
  onPlan,
  disabled,
}: {
  sheet: MotionSheetView | null;
  planning: boolean;
  onPlan: () => void;
  disabled: boolean;
}) {
  const verified = !!sheet?.verified?.pass;
  return (
    <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Motion plan{" "}
          {planning ? (
            <span className="normal-case text-violet-300">— directing… reading the script, the picture and the rules (~20 s)</span>
          ) : verified ? (
            <span className="normal-case text-emerald-300">
              — verified ✓{sheet?.verified?.rounds && sheet.verified.rounds > 1 ? ` (${sheet.verified.rounds} rounds)` : ""}
              {sheet?.rulesVersion ? ` · rules ${String(sheet.rulesVersion).slice(0, 8)}` : ""}
              {sheet?.engine ? ` · for ${sheet.engine}` : ""}
            </span>
          ) : (
            <span className="normal-case text-zinc-500">— none yet. Animate plans + verifies automatically first; or preview it here.</span>
          )}
        </span>
        <button
          type="button"
          onClick={onPlan}
          disabled={disabled || planning}
          className="rounded px-2 py-0.5 text-[10px] font-semibold text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
          title="Have the director read the whole script + this picture + the rulebook and write a verified motion plan (a few cents, ~20 s). Nothing renders."
        >
          {planning ? "…" : verified ? "Plan again" : "Plan motion"}
        </button>
      </div>
      {sheet && verified ? (
        <div className="mt-1.5 space-y-1 text-[11px] text-zinc-300">
          {sheet.beat ? <p className="text-zinc-400">{sheet.beat}</p> : null}
          <ul className="space-y-0.5">
            {(sheet.moves ?? []).map((m, i) => (
              <li key={i}>
                <span className="text-violet-300">{i === 0 ? "▶" : "•"}</span>{" "}
                <span className="font-semibold text-zinc-200">{m.element}</span> {m.action}
                <span className="text-zinc-500">
                  {m.magnitude ? ` · ${m.magnitude}` : ""}
                  {m.timing ? ` · ${m.timing}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {sheet.mustNotMove?.length ? (
            <p className="text-[10px] text-zinc-500">
              Stays still: {sheet.mustNotMove.join(", ")}
            </p>
          ) : null}
          <p className="text-[10px] text-zinc-500">
            Camera: {sheet.camera?.mode ?? "fixed"}
            {sheet.camera?.why ? ` — ${sheet.camera.why}` : ""}
            {sheet.rulesApplied?.length ? ` · rules: ${sheet.rulesApplied.slice(0, 6).join(", ")}` : ""}
          </p>
          {sheet.compiled?.prompt ? (
            <p className="truncate font-mono text-[10px] text-zinc-600" title={sheet.compiled.prompt}>
              → {sheet.compiled.prompt}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RunStrip({ run }: { run: RunStatus }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, (now - run.startedAt) / 1000);
  const perUnit = etaSeconds(run.etaLabel);
  const expectedTotal = perUnit * run.total;
  const pct = Math.min(96, Math.round((elapsed / expectedTotal) * 100));
  const over = elapsed > expectedTotal;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400 align-middle" />
          Running — {run.label}
          {run.total > 1 ? ` · ${run.step} of ${run.total}` : ""}
        </span>
        <span className="tabular-nums">
          {fmtClock(elapsed)} elapsed · usually {run.etaLabel}
          {run.total > 1 ? ` each (≈ ${fmtClock(expectedTotal)} total)` : ""}
          {over ? " · taking longer than usual, still working" : ""}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-900/40">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {run.detail ? (
        <p className="mt-1 truncate font-mono text-[10px] text-amber-200/70">{run.detail}</p>
      ) : (
        <p className="mt-1 text-[10px] text-amber-200/70">
          You can keep editing other scenes. Leaving the page does not cancel the job; the scene updates when it lands.
        </p>
      )}
    </div>
  );
}

export type RenderScope = "scene" | "selected" | "missing" | "all";

const GROUP_ORDER: AnimationTierGroup[] = ["calm", "action", "premium", "photoreal"];

export function engineSupportsMotionControls(q: AnimationQuality): boolean {
  const t = CUSTOMER_ANIMATION_TIERS.find((x) => x.id === q);
  return t?.group === "calm" || t?.group === "action";
}

export function engineLabel(q: AnimationQuality): string {
  return ANIMATION_PRICES[q]?.label ?? q;
}

/** Shape of the DGX Motion Sheet we render (opaque elsewhere). */
export type MotionSheetView = {
  beat?: string;
  narrationImplies?: string;
  moves?: Array<{ element?: string; action?: string; magnitude?: string; timing?: string; why?: string }>;
  mustNotMove?: string[];
  camera?: { mode?: string; why?: string };
  rulesApplied?: string[];
  verified?: { pass?: boolean; rounds?: number };
  compiled?: { prompt?: string; engine?: string; family?: string };
  rulesVersion?: string | null;
  stillVersion?: number;
  engine?: string;
  userInstruction?: string | null;
};

export type RenderPanelProps = {
  scope: RenderScope;
  onScopeChange: (s: RenderScope) => void;
  counts: { scene: number | null; selected: number; missing: number; all: number };
  activeSceneNumber: number | null;
  engine: AnimationQuality;
  onEngineChange: (q: AnimationQuality) => void;
  motion: MotionIntensity;
  onMotionChange: (m: MotionIntensity) => void;
  holdStartPose: boolean;
  onHoldChange: (v: boolean) => void;
  lockCamera: boolean;
  onLockCameraChange: (v: boolean) => void;
  scenePrompt: string;
  onScenePromptChange: (v: string) => void;
  onPlan: () => void;
  planning: boolean;
  /** Verified sheet for the active scene (null = none yet). */
  sheet?: MotionSheetView | null;
  /** Buttons */
  onAnimate: () => void;
  onRedraw: () => void;
  onRender: () => void;
  onSaveDraft: () => void;
  busy: { animating: boolean; redrawing: boolean; rendering: boolean; saving: boolean };
  progressLine?: string | null;
  run?: RunStatus | null;
  unmetered: boolean;
};

export function targetCountForScope(scope: RenderScope, counts: RenderPanelProps["counts"]): number {
  if (scope === "scene") return counts.scene ?? 0;
  if (scope === "selected") return counts.selected;
  if (scope === "missing") return counts.missing;
  return counts.all;
}

export function RenderPanel(p: RenderPanelProps) {
  const price = ANIMATION_PRICES[p.engine];
  const tier = CUSTOMER_ANIMATION_TIERS.find((t) => t.id === p.engine);
  const n = targetCountForScope(p.scope, p.counts);
  const supportsMotion = engineSupportsMotionControls(p.engine);
  const animateTotal = n * price.priceCents;
  const redrawTotal = n * FLAT_ACTION_PRICES.scene.priceCents;

  const scopeLabel =
    p.scope === "scene"
      ? p.activeSceneNumber
        ? `scene ${p.activeSceneNumber}`
        : "no scene picked"
      : p.scope === "selected"
        ? `${n} selected scene${n === 1 ? "" : "s"}`
        : p.scope === "missing"
          ? `${n} scene${n === 1 ? "" : "s"} without a clip`
          : `all ${n} scene${n === 1 ? "" : "s"}`;

  const sentence =
    n === 0
      ? p.scope === "selected"
        ? "Tick scenes on the timeline to build a selection."
        : p.scope === "missing"
          ? "Every scene already has a clip — switch scope to re-do them."
          : "Pick a scene on the timeline."
      : `Animate ${scopeLabel} with ${price.label} — ${n} × ${formatPrice(price.priceCents)} = ${formatPrice(animateTotal)}` +
        (p.scope === "missing" ? ". Existing clips are kept." : n > 0 && p.scope !== "scene" ? ". Existing clips on those scenes are replaced." : ".") +
        (supportsMotion
          ? ` Motion: ${p.motion}${p.holdStartPose ? " + end on start pose" : ""}.`
          : ` ${price.label} decides its own amount of movement.`) +
        (p.lockCamera ? " Camera locked." : "") +
        ` About ${price.etaLabel} per clip.`;

  const sel =
    "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-[11px] text-zinc-200 focus:border-violet-500/60 focus:outline-none disabled:opacity-50";
  const lab = "mb-1 block text-[10px] uppercase tracking-wider text-zinc-500";
  const anyBusy = p.busy.animating || p.busy.redrawing || p.busy.rendering;

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_auto]">
        <div>
          <label className={lab} htmlFor="rp-scope">Which scenes</label>
          <select
            id="rp-scope"
            className={sel}
            value={p.scope}
            onChange={(e) => p.onScopeChange(e.target.value as RenderScope)}
            disabled={anyBusy}
          >
            <option value="scene">
              This scene{p.activeSceneNumber ? ` (${p.activeSceneNumber})` : ""}
            </option>
            <option value="selected" disabled={p.counts.selected === 0}>
              Selected ({p.counts.selected})
            </option>
            <option value="missing">Without a clip ({p.counts.missing})</option>
            <option value="all">All scenes ({p.counts.all})</option>
          </select>
        </div>
        <div>
          <label className={lab} htmlFor="rp-engine">Engine · price per clip · time</label>
          <select
            id="rp-engine"
            className={sel}
            value={p.engine}
            onChange={(e) => p.onEngineChange(e.target.value as AnimationQuality)}
            disabled={anyBusy}
          >
            {GROUP_ORDER.map((g) => (
              <optgroup key={g} label={ANIMATION_TIER_GROUPS[g].label}>
                {CUSTOMER_ANIMATION_TIERS.filter((t) => t.group === g).map((t) => {
                  const pr = ANIMATION_PRICES[t.id];
                  return (
                    <option key={t.id} value={t.id} title={t.blurb}>
                      {pr.label}
                      {t.recommended ? " ⭐" : ""} — {formatPrice(pr.priceCents)} · {pr.etaLabel}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-zinc-500">
            {tier ? `${tier.blurb} ${ANIMATION_TIER_GROUPS[tier.group].hint}` : ""}
            {tier?.cartoonUnsafe ? (
              <span className="text-amber-400"> ⚠ Rejects cartoon faces.</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className={lab}>Camera</span>
          <label className="flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              checked={p.lockCamera}
              onChange={(e) => p.onLockCameraChange(e.target.checked)}
              className="h-3.5 w-3.5 accent-violet-500"
              disabled={anyBusy}
            />
            Lock (no pan/zoom)
          </label>
        </div>
      </div>

      {supportsMotion ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr]">
          <div>
            <span className={lab}>How much movement</span>
            <div className="flex gap-1">
              {(
                [
                  { id: "subtle", label: "Subtle", desc: "Slow, calm, mouth closed — the default" },
                  { id: "normal", label: "Normal", desc: "Everyday movement" },
                  { id: "bold", label: "Bold", desc: "Big movement — action beats only" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.desc}
                  disabled={anyBusy}
                  onClick={() => p.onMotionChange(opt.id)}
                  className={`rounded px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    p.motion === opt.id
                      ? "bg-violet-500/30 text-violet-200 ring-1 ring-violet-500/60"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              checked={p.holdStartPose}
              onChange={(e) => p.onHoldChange(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-violet-500"
              disabled={anyBusy}
            />
            <span>
              <span className="font-semibold text-zinc-200">End on the starting pose</span>
              <span className="block text-[10px] text-zinc-500">
                Stops wandering hands, mouth flap and face drift. Best for talking / close-ups.
              </span>
            </span>
          </label>
        </div>
      ) : (
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-[10px] text-zinc-500">
          {price.label} decides its own amount of movement — the Subtle / Normal / Bold controls only apply to Wan 2.2 and Hunyuan engines.
        </p>
      )}

      {p.scope === "scene" ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={lab} htmlFor="rp-prompt">
              Director&rsquo;s note for scene {p.activeSceneNumber ?? "—"}{" "}
              <span className="normal-case text-zinc-600">(optional — the director reads the whole script and the picture either way)</span>
            </label>
          </div>
          <textarea
            id="rp-prompt"
            rows={2}
            value={p.scenePrompt}
            onChange={(e) => p.onScenePromptChange(e.target.value)}
            disabled={anyBusy}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-violet-500/60 focus:outline-none disabled:opacity-50"
            placeholder='e.g. "he should point back at the store, not wave"'
          />
          <MotionPlanCard sheet={p.sheet ?? null} planning={p.planning} onPlan={p.onPlan} disabled={anyBusy || p.activeSceneNumber === null} />
        </div>
      ) : (
        <p className="text-[10px] text-zinc-500">
          Each scene uses its own “what moves” text if it has one; blank scenes get AI-written motion that follows your rules.
        </p>
      )}

      <p className="rounded-md border border-violet-500/30 bg-zinc-950/60 px-3 py-2 text-[11px] text-violet-200">
        {p.progressLine ?? sentence}
      </p>
      {p.run ? <RunStrip run={p.run} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={p.onAnimate}
          disabled={anyBusy || n === 0}
          className="rounded-lg bg-violet-500/25 px-4 py-2 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/40 disabled:opacity-50"
          title={sentence}
        >
          {p.busy.animating
            ? "Animating…"
            : `Animate ${scopeLabel} — ${p.unmetered ? "no charge" : formatPrice(animateTotal)}`}
        </button>
        <button
          type="button"
          onClick={p.onRedraw}
          disabled={anyBusy || n === 0}
          className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
          title={`Redraw the still picture for ${scopeLabel} from each scene's picture prompt. ${formatPrice(FLAT_ACTION_PRICES.scene.priceCents)} per picture. Clips on those scenes are removed.`}
        >
          {p.busy.redrawing
            ? "Redrawing…"
            : `Redraw picture${n === 1 ? "" : "s"} (${n}) — ${p.unmetered ? "no charge" : formatPrice(redrawTotal)}`}
        </button>
        <span className="mx-1 hidden h-6 w-px bg-zinc-800 md:block" />
        <button
          type="button"
          onClick={p.onRender}
          disabled={anyBusy}
          className="rounded-lg bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
          title={`Stitch the current pictures, clips, voiceover and captions into a new final MP4. ${formatPrice(FLAT_ACTION_PRICES.render.priceCents)}. Publishes nothing.`}
        >
          {p.busy.rendering
            ? "Rendering…"
            : `Render final video — ${p.unmetered ? "no charge" : formatPrice(FLAT_ACTION_PRICES.render.priceCents)}`}
        </button>
        <button
          type="button"
          onClick={p.onSaveDraft}
          disabled={p.busy.saving}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          title="Free. Saves narration / picture-prompt edits. Renders nothing."
        >
          {p.busy.saving ? "Saving…" : "Save draft (free)"}
        </button>
      </div>
    </div>
  );
}
