"use client";

/**
 * "What are we creating?" gate.
 *
 * Rendered on YouTubeProjectDetail when project.status === "transcribed".
 * Collects the goal + length + style + voice + custom prompt, then POSTs
 * to /api/vater/youtube/[id]/context which flips status into
 * extracting_principles and kicks off /vater/run-creation.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { YouTubeStyleDocumentPicker } from "./youtube-style-document-picker";
import { YouTubeVoiceClonePanel } from "./youtube-voice-clone-panel";
import { YouTubePopularVoices } from "./youtube-popular-voices";
import { YouTubeGoalPicker } from "./youtube-goal-picker";
import { YouTubeMusicPicker } from "./youtube-music-picker";
import { YouTubeCreatorModelPicker } from "./youtube-creator-model-picker";
import { DEFAULT_STYLE_PRESET } from "@/lib/vater/style-presets";
import {
  type GoalTemplate,
  normalizeSuggestion,
} from "@/lib/vater/goal-templates";
import {
  type CreatorModel,
  type CreatorModelId,
  isCreatorModelId,
} from "@/lib/vater/creator-models";
import { WORDS_PER_MINUTE } from "@/lib/vater/youtube-types";
const MIN_DURATION = 1;
const MAX_DURATION = 30;

interface ProjectShape {
  id: string;
  transcript: string | null;
  goal: string | null;
  targetDuration: number;
  targetWordCount: number;
  stylePreset: string | null;
  customStylePrompt: string | null;
  voiceName: string | null;
  backgroundMusicId?: string | null;
  musicVolume?: number | null;
  /**
   * AI-generated goal suggestions populated by the DGX `_suggest_goals` step
   * right after whisper. May be null (legacy projects), undefined, or any
   * shape — we normalize defensively below.
   */
  goalSuggestions?: unknown;
}

interface Props {
  project: ProjectShape;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmitted: (project: any) => void;
}

export function YouTubeContextForm({ project, onSubmitted }: Props) {
  const { toast } = useToast();
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [goal, setGoal] = useState(project.goal ?? "");
  const [duration, setDuration] = useState(project.targetDuration || 10);
  const [wordCountOverride, setWordCountOverride] = useState<number | null>(
    project.targetWordCount &&
      project.targetWordCount !== project.targetDuration * WORDS_PER_MINUTE
      ? project.targetWordCount
      : null,
  );
  // "I have a script — use mine" path. When toggled, the DGX skips principle
  // extraction + script generation and uses the pasted text verbatim. Goal
  // becomes optional metadata; duration/word-count sliders become advisory
  // (the actual word count IS the script length).
  const [useOwnScript, setUseOwnScript] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const scriptWordCount = useMemo(
    () => scriptText.trim().split(/\s+/).filter(Boolean).length,
    [scriptText],
  );
  const [voiceCloneName, setVoiceCloneName] = useState<string | null>(
    project.voiceName,
  );
  const [selectedGoalTemplate, setSelectedGoalTemplate] =
    useState<GoalTemplate | null>(null);
  const [backgroundMusicId, setBackgroundMusicId] = useState<string | null>(
    project.backgroundMusicId ?? null,
  );
  const [musicVolume, setMusicVolume] = useState(
    typeof project.musicVolume === "number" ? project.musicVolume : 0.18,
  );
  const [consistency, setConsistency] = useState(70);
  // Cloud rental: when on, word count cap raises from 4500 → 10000 so the
  // user can generate long-form videos. Pricing is shown inline so the user
  // sees what it'll actually cost to render on H100 Modal. The flag itself
  // threads through to DGX in the payload; the backend can opt into H100
  // tier automatically when this is set.
  const [cloudRental, setCloudRental] = useState(false);
  // videoBackend pinned to SDXL stills — scene-by-scene animation is chosen
  // in the editor instead of globally here (cheaper, lower-regret pattern).
  const videoBackend: string = "sdxl";
  // TubeGen-parity: project-level animation mode. Controls how the i2v
  // stage runs after scene generation. "none" = stills only. "all" =
  // animate every scene. "longer-only" = scenes >= 5s. "per-scene" =
  // user flags specific scenes in the editor.
  const [animMode, setAnimMode] = useState<
    "none" | "all" | "longer-only" | "per-scene"
  >("all");
  const [animQuality, setAnimQuality] = useState<
    | "modal-wan22"
    | "modal-wan22-fast"
    | "modal-wan22-narrative"
    | "modal-wan22-narrative-fast"
    | "modal-hunyuan-narrative"
    | "modal-hunyuan-narrative-fast"
    | "wan22-local"
    | "ltx-local"
    | "turbo"
    | "default"
    | "default_1080p"
    | "high"
    | "kling-standard"
    | "kling-pro"
    | "kling-master"
    | "luma"
  >("modal-wan22-narrative");
  // Image renderer override. Empty string means "use the picked Style's
  // defaultQuality, or cloud-rental default if that's checked." Anything
  // else is sent verbatim as `imageQuality` to the context route.
  const [imageQuality, setImageQuality] = useState<string>("");
  // Phase 1+ Style document — when set, takes precedence over stylePreset
  // and threads CustomArtStyle + characters + reference transcripts to DGX
  const [styleId, setStyleId] = useState<string | null>(null);
  const [selectedStyleName, setSelectedStyleName] = useState<string | null>(null);
  // Standalone Custom Art Style (CAS). Can be attached with or without a
  // Style document — when a Style is picked, the Style's own CAS wins; when
  // no Style is picked, this value threads through to DGX directly.
  const [customArtStyleId, setCustomArtStyleId] = useState<string | null>(
    null,
  );
  // CAS list loaded from the API for the standalone picker.
  const [cas, setCas] = useState<
    Array<{ id: string; name: string; thumbnailUrl: string | null; description: string | null }>
  >([]);
  const [casLoading, setCasLoading] = useState(true);
  const [creatorModelId, setCreatorModelId] = useState<CreatorModelId | null>(
    null,
  );
  const [activeCreatorModel, setActiveCreatorModel] =
    useState<CreatorModel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [regeneratingGoals, setRegeneratingGoals] = useState(false);

  const targetWordCount = useMemo(
    () =>
      useOwnScript
        ? Math.max(1, scriptWordCount)
        : (wordCountOverride ?? duration * WORDS_PER_MINUTE),
    [useOwnScript, scriptWordCount, duration, wordCountOverride],
  );

  // Load the user's Custom Art Styles for the standalone picker. Fires once
  // when the form mounts — the list is short (<50 entries).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/vater/youtube/custom-art-styles");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (alive) setCas(data.customArtStyles ?? []);
      } catch {
        if (alive) setCas([]);
      } finally {
        if (alive) setCasLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Parse AI-suggested goals from the project prop. The DGX worker writes
  // this as JSON (array or { suggestions: [...] }) and we normalize each
  // entry defensively — stripping any stray duration/wordCount keys and
  // forcing source="suggested" so they group correctly in the picker.
  // useMemo computes the initial value; useState allows regeneration to update it.
  const initialGoalSuggestions = useMemo<GoalTemplate[]>(() => {
    const raw = project.goalSuggestions;
    if (!raw) return [];
    let list: unknown[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (typeof raw === "object") {
      const obj = raw as { suggestions?: unknown };
      if (Array.isArray(obj.suggestions)) list = obj.suggestions;
    }
    return list
      .map((item) => normalizeSuggestion(item))
      .filter((t): t is GoalTemplate => t !== null);
  }, [project.goalSuggestions]);
  const [goalSuggestions, setGoalSuggestions] =
    useState<GoalTemplate[]>(initialGoalSuggestions);

  const transcript = project.transcript ?? "";
  const transcriptPreview = transcript.slice(0, 500);
  const hasMoreTranscript = transcript.length > 500;

  const canSubmit = useOwnScript
    ? scriptText.trim().length > 0 && !!voiceCloneName && !submitting
    : goal.trim().length > 0 && !!voiceCloneName && !submitting;

  const handleCreatorModelChange = (model: CreatorModel | null) => {
    if (model) {
      setCreatorModelId(model.id as CreatorModelId);
      setActiveCreatorModel(model);
      setDuration(model.recommendedDuration);
      setWordCountOverride(null);
    } else {
      setCreatorModelId(null);
      setActiveCreatorModel(null);
    }
  };

  // Merge creator model goals with AI-suggested goals
  const mergedGoalSuggestions = useMemo(() => {
    const modelGoals = activeCreatorModel?.goalTemplates ?? [];
    return [...modelGoals, ...goalSuggestions];
  }, [activeCreatorModel, goalSuggestions]);

  const handleRegenerateGoals = async () => {
    setRegeneratingGoals(true);
    try {
      const res = await fetch(
        `/api/vater/youtube/${project.id}/suggest-goals`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw: unknown[] = Array.isArray(data.suggestions)
        ? data.suggestions
        : [];
      const normalized = raw
        .map((item) => normalizeSuggestion(item))
        .filter((t): t is GoalTemplate => t !== null);
      setGoalSuggestions(normalized);
      toast({
        title: "Goals refreshed",
        description: `${normalized.length} new suggestions ready.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Could not refresh goals",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setRegeneratingGoals(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/vater/youtube/${project.id}/context`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: useOwnScript
              ? goal.trim() || "User-supplied script"
              : goal.trim(),
            targetDuration: duration,
            targetWordCount,
            stylePreset: DEFAULT_STYLE_PRESET,
            voiceCloneName,
            backgroundMusicId: backgroundMusicId ?? null,
            musicVolume,
            consistency,
            videoBackend,
            // TubeGen-parity animation mode (i2v post-stage). When non-
            // "none", the DGX animate stage turns selected stills into
            // MP4 clips via vater_i2v before composing the final video.
            animMode,
            animQuality,
            ...(imageQuality ? { imageQuality } : {}),
            creatorModelId: creatorModelId ?? undefined,
            scriptGuidelines: activeCreatorModel?.scriptGuidelines ?? undefined,
            // Phase 1 — when set, the Style document overrides the legacy
            // preset path and threads characters + CustomArtStyle + ref
            // transcripts inline to the DGX worker.
            styleId: styleId ?? undefined,
            customArtStyleId: customArtStyleId ?? undefined,
            cloudRental,
            // User-supplied script: skips principle extraction +
            // _generate_script() on the DGX. No min length enforced.
            ...(useOwnScript && scriptText.trim()
              ? { scriptOverride: scriptText.trim() }
              : {}),
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast({
        title: "Pipeline started",
        description: useOwnScript
          ? `Using your ${scriptWordCount}-word script — heading straight to TTS + scenes`
          : "Extracting principles + writing original script...",
        variant: "success",
      });
      onSubmitted(data.project);
    } catch (err) {
      toast({
        title: "Could not start pipeline",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Styles picker — moved to the TOP of the form 2026-04-22 per user.
          A selected Style carries voice/characters/CAS/etc into the pipeline
          and overrides the legacy stylePreset selector below. */}
      <YouTubeStyleDocumentPicker
        value={styleId}
        onChange={(id, style) => {
          setStyleId(id);
          setSelectedStyleName(style?.name ?? null);
          if (style) {
            if (style.voice) setVoiceCloneName(style.voice);
            setConsistency(style.defaultConsistency);
          }
        }}
      />

      {/* Standalone Custom Art Style picker — sits right below Styles so the
          visual direction is decided before anything else. When a Style is
          picked above, the Style's own CAS takes precedence; otherwise this
          picker threads directly to DGX. */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Custom Art Style{" "}
            <span className="ml-1 text-[10px] font-normal normal-case text-zinc-400">
              (optional — upload reference images, get a hex-coded descriptor)
            </span>
          </div>
          <Link
            href="/vater/youtube/custom-art-styles"
            className="text-[11px] text-sky-400 hover:text-sky-300"
          >
            Manage →
          </Link>
        </div>
        {casLoading ? (
          <p className="text-[11px] text-zinc-400">Loading your art styles…</p>
        ) : cas.length === 0 ? (
          <p className="text-[11px] text-zinc-400">
            No custom art styles yet.{" "}
            <Link
              href="/vater/youtube/custom-art-styles"
              className="text-sky-400 hover:text-sky-300"
            >
              Create one →
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCustomArtStyleId(null)}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition ${
                customArtStyleId === null
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              None
            </button>
            {cas.map((c) => {
              const active = c.id === customArtStyleId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomArtStyleId(active ? null : c.id)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition ${
                    active
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {c.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.thumbnailUrl}
                      alt={c.name}
                      className="h-5 w-5 rounded object-cover"
                    />
                  ) : null}
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
        {customArtStyleId && !styleId && (
          <p className="mt-2 text-[10px] text-emerald-300/80">
            ✓ This art style will be used as the visual direction for every
            scene.
          </p>
        )}
        {customArtStyleId && styleId && (
          <p className="mt-2 text-[10px] text-amber-300/80">
            ⚠ A Style is also selected above. The Style&rsquo;s own art
            direction wins — this standalone pick is ignored until you pick
            &ldquo;None&rdquo; for the Style.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">
          What are we creating?
        </h3>
        <p className="text-xs text-zinc-300">
          Transcript ready. Tell the pipeline what you want the final video
          to be — goal, length, visual style, and the voice clone to narrate
          it.
        </p>
      </div>

      {/* Transcript preview */}
      {transcript && !useOwnScript && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-400">
            <span>Source transcript</span>
            <span>{transcript.length.toLocaleString()} chars</span>
          </div>
          <div
            className={`text-xs leading-relaxed text-zinc-400 ${
              showFullTranscript ? "max-h-96 overflow-y-auto" : ""
            }`}
          >
            {showFullTranscript ? transcript : transcriptPreview}
            {!showFullTranscript && hasMoreTranscript && "..."}
          </div>
          {hasMoreTranscript && (
            <button
              type="button"
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="mt-2 text-[10px] text-sky-400 underline-offset-2 hover:underline"
            >
              {showFullTranscript ? "Show less" : "Show full transcript"}
            </button>
          )}
        </div>
      )}

      {/* "Use my own script" — overrides DGX script generation. When on, the
          worker skips principle extraction + _generate_script() and uses this
          text verbatim for TTS + scene planning. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 transition hover:border-sky-500/30">
        <input
          type="checkbox"
          checked={useOwnScript}
          onChange={(e) => setUseOwnScript(e.target.checked)}
          className="mt-0.5 accent-sky-400"
          disabled={submitting}
        />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-zinc-200">
            I have a script — use mine
          </span>
          <span className="mt-0.5 block text-[11px] text-zinc-400">
            Skips principle extraction + script generation. Goes straight to
            TTS + scene planning. Any length — no minimum.
          </span>
        </span>
      </label>

      {useOwnScript && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">
            Your script
          </label>
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="Paste your script here. Any length — no minimum, no maximum."
            rows={14}
            className="w-full resize-y rounded-lg border border-sky-500/30 bg-zinc-950/60 p-3 font-mono text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
            disabled={submitting}
          />
          <p className="mt-1 text-[10px] text-zinc-400">
            {scriptWordCount} words ≈{" "}
            {(scriptWordCount / WORDS_PER_MINUTE).toFixed(1)} min narration at{" "}
            {WORDS_PER_MINUTE} wpm.{" "}
            {transcript && (
              <span className="text-amber-300/80">
                Source transcript will be ignored.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Creator Model */}
      <YouTubeCreatorModelPicker
        value={creatorModelId}
        onChange={handleCreatorModelChange}
        disabled={submitting}
      />

      {/* Goal */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Goal{" "}
            {useOwnScript && (
              <span className="ml-1 text-[10px] font-normal normal-case text-zinc-500">
                (optional — metadata only)
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={handleRegenerateGoals}
            disabled={regeneratingGoals || submitting}
            className="text-[10px] text-zinc-300 underline-offset-2 hover:text-zinc-300 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            {regeneratingGoals ? "Refreshing..." : "Regenerate suggestions"}
          </button>
        </div>
        <YouTubeGoalPicker
          suggestions={mergedGoalSuggestions}
          value={selectedGoalTemplate}
          onChange={(tpl) => {
            setSelectedGoalTemplate(tpl);
            setGoal(tpl.goalText);
            // CRITICAL: do NOT touch setDuration() or setWordCountOverride()
            // here. The user controls length on their own sliders below. See
            // memory/feedback_goal_vs_duration_separation.md for the rule.
          }}
          disabled={submitting}
        />
        <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">
            ▸ Advanced: customize the goal text
          </summary>
          <div className="px-3 pb-3">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Write your own goal prompt here..."
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 p-3 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
              disabled={submitting}
            />
            <p className="mt-1 text-[10px] text-zinc-300">
              Overrides the picked template. Duration is still controlled by
              the slider below.
            </p>
          </div>
        </details>
      </div>

      {/* Duration + word count — hidden when bringing your own script
          (the script length IS the word count). */}
      {!useOwnScript && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span>Target duration</span>
              <span className="text-[10px] font-normal text-zinc-400">
                {duration} min
              </span>
            </label>
            <input
              type="range"
              min={MIN_DURATION}
              max={MAX_DURATION}
              step={1}
              value={duration}
              onChange={(e) => {
                setDuration(parseInt(e.target.value, 10));
                setWordCountOverride(null);
              }}
              className="w-full accent-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span>Target word count</span>
              {wordCountOverride !== null && (
                <button
                  type="button"
                  onClick={() => setWordCountOverride(null)}
                  className="text-[10px] font-normal text-zinc-300 underline-offset-2 hover:underline"
                >
                  reset
                </button>
              )}
            </label>
            <input
              type="number"
              min={150}
              max={10000}
              step={50}
              value={targetWordCount}
              onChange={(e) =>
                setWordCountOverride(parseInt(e.target.value, 10) || null)
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 focus:border-sky-400/40 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-zinc-300">
              ~{Math.round(targetWordCount / WORDS_PER_MINUTE)} min at{" "}
              {WORDS_PER_MINUTE} wpm
            </p>
          </div>
        </div>
      )}

      {/* Cloud rental — always selectable. Past LOCAL_SCENE_LIMIT scenes the
          DGX can't process the run in a reasonable time, so we auto-enable
          and lock the toggle ON. Cost panel shows BOTH stills-only and
          animated price so the user sees the trade-off at a glance. */}
      {(() => {
        const LOCAL_SCENE_LIMIT = 180;
        const projectedScenes = Math.ceil(targetWordCount / 12.5);
        const localOverflow = projectedScenes > LOCAL_SCENE_LIMIT;
        // When local can't handle it, force cloud on and disable the toggle.
        // Effect runs in render — cheap, idempotent, and avoids a stale
        // intermediate render where the user could uncheck it before the
        // effect fires.
        if (localOverflow && !cloudRental) {
          // Defer the state update to avoid setState-in-render warning
          queueMicrotask(() => setCloudRental(true));
        }
        const effectiveCloud = cloudRental || localOverflow;

        return (
      <div
        className={`rounded-lg border p-3 transition-all ${
          effectiveCloud
            ? "border-amber-400/60 bg-amber-500/10 shadow-[0_0_14px_rgba(251,191,36,0.2)]"
            : "border-zinc-800 bg-zinc-950/40"
        }`}
      >
        <label className={`flex items-start gap-3 ${localOverflow ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            checked={effectiveCloud}
            disabled={localOverflow}
            onChange={(e) => setCloudRental(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-400 disabled:opacity-60"
          />
          <div className="flex-1">
            <div className="text-xs font-semibold text-amber-200">
              ⚡ Cloud rental — FireRed + Modal (free up the DGX)
              {localOverflow && (
                <span className="ml-2 rounded bg-amber-500/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-100">
                  required
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-300">
              {localOverflow ? (
                <>
                  Required for runs above {LOCAL_SCENE_LIMIT} scenes (~
                  {Math.round((LOCAL_SCENE_LIMIT * 12.5) / WORDS_PER_MINUTE)}{" "}
                  min). The DGX can&rsquo;t process more than{" "}
                  {LOCAL_SCENE_LIMIT} scenes in a single batch — Modal
                  L40S parallelises the work and frees the box.
                </>
              ) : (
                <>
                  Bursts the paid pipeline to Modal serverless GPUs:
                  FireRed stills on L40S (~$0.03/scene, same model as
                  local DGX) plus Modal Wan2.2 i2v if animation is on.
                  Free up the DGX during long runs.
                </>
              )}
            </p>
            {effectiveCloud && (() => {
              // Cost model — calibrated 2026-04-25 against a real 120-PNG /
              // 25-animated run (project d91d9). Shows BOTH stills-only and
              // animated price so the user sees the trade-off at a glance.
              //   FireRed still: BF16 on H100 — measured $1.50 for 120 PNGs
              //                  (≈ $1.00 fixed warmup + $0.005/scene marginal).
              //   Wan2.2 i2v:    measured $8.02 for 25 scenes on Modal narrative
              //                  L40S → ~$0.32/clip. H100 fast variant scales
              //                  ~25% higher → ~$0.40/clip.
              //   Kimi LLM:      ~10 calls/video at ~$0.40/call ≈ $4 fixed,
              //                  scales slowly with scene count via prompt
              //                  + animation chunking (chunk_size=100/50).
              //   ElevenLabs:    Starter $5/mo subscription — marginal $0;
              //                  shown as $0.0015/word for forecasting only.
              //   Compose:       Vercel Remotion, ~$0.02.
              // Buffer: +20% covers Modal cold-start variance + supplier drift.
              const BUFFER = 0.20;
              const animated = animMode !== "none";
              const rate = (words: number) => {
                const scenes = Math.ceil(words / 12.5);
                const ttsCost = words * 0.0015;
                // Stills: $1.00 fixed warmup amortized + $0.005/scene marginal
                const stillCost = 1.0 + scenes * 0.005;
                // Wan2.2 i2v per-scene rate (measured H100 narrative ≈ $0.32)
                const i2vL40S = scenes * 0.32;
                const i2vH100 = scenes * 0.40;
                // Kimi LLM: fixed pipeline calls (script/planner/verify/etc)
                // + scene-prompt chunks (1 per 100 scenes) + anim plan chunks
                // (1 per 50 scenes). Avg call ≈ $0.40.
                const llmFixedCalls = 6; // suggest_goals + script + verify + classify + character + 1 buffer
                const llmChunkCalls =
                  Math.ceil(scenes / 100) + (animated ? Math.ceil(scenes / 50) : 0);
                const llmCost = (llmFixedCalls + llmChunkCalls) * 0.4;
                const stillsOnlyRaw = ttsCost + stillCost + llmCost + 0.02;
                const animatedL40SRaw = stillsOnlyRaw + i2vL40S;
                const animatedH100Raw = stillsOnlyRaw + i2vH100;
                return {
                  scenes,
                  ttsCost,
                  stillCost,
                  llmCost,
                  stillsOnly: stillsOnlyRaw * (1 + BUFFER),
                  animatedL40S: animatedL40SRaw * (1 + BUFFER),
                  animatedH100: animatedH100Raw * (1 + BUFFER),
                };
              };
              const cur = rate(targetWordCount);
              const max = rate(10000);
              return (
                <div className="mt-2 space-y-2 rounded-md border border-amber-500/30 bg-black/30 p-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-zinc-400">Est. scenes</div>
                      <div className="font-semibold text-amber-200">
                        ~{cur.scenes}
                      </div>
                      <div className="mt-1 text-[9px] uppercase tracking-wider text-zinc-500">
                        {animated ? "🎬 animation: ON" : "🖼️ stills only"}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-400">
                        At {targetWordCount.toLocaleString()} words
                      </div>
                      <div className="mt-0.5 grid grid-cols-1 gap-0.5">
                        <div className={animated ? "text-zinc-400" : "font-semibold text-amber-200"}>
                          <span className="text-zinc-500">stills only:</span>{" "}
                          ~${cur.stillsOnly.toFixed(2)}
                        </div>
                        <div className={animated ? "font-semibold text-amber-200" : "text-zinc-500"}>
                          <span className="text-zinc-500">+ animation:</span>{" "}
                          ~${cur.animatedL40S.toFixed(2)}
                          <span className="ml-1 text-[9px] text-zinc-500">L40S</span>
                          <span className="ml-1 text-[9px] text-zinc-500">
                            / ${cur.animatedH100.toFixed(0)} H100
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-amber-500/20 pt-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                      At 10K word max ({max.scenes} scenes)
                    </div>
                    <div className="mt-0.5 grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500">stills only:</span>{" "}
                        <span className="text-amber-200">~${max.stillsOnly.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">+ anim:</span>{" "}
                        <span className="text-amber-200">~${max.animatedL40S.toFixed(0)}</span>
                        <span className="ml-1 text-zinc-500">L40S</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] leading-snug text-zinc-300">
                    Stills-only = ElevenLabs TTS (~${cur.ttsCost.toFixed(2)})
                    + FireRed BF16 on Modal H100 (~${cur.stillCost.toFixed(2)},
                    ~$1.00 warmup + ~$0.005/scene) + Kimi LLM (~${cur.llmCost.toFixed(2)})
                    + compose. Animated adds Wan2.2 i2v at ~$0.32/scene (L40S)
                    or ~$0.40/scene (H100). Switch to{" "}
                    <strong className="text-amber-200">No animation</strong>{" "}
                    in the row below to lock in the stills-only price.
                  </p>
                </div>
              );
            })()}
          </div>
        </label>
      </div>
        );
      })()}

      {/* Scene consistency */}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-400">
          <span>Scene consistency</span>
          <span className="text-[10px] font-normal text-zinc-400">
            {consistency}%
            {consistency === 0
              ? " (off)"
              : consistency < 40
                ? " (low)"
                : consistency < 60
                  ? " (medium)"
                  : consistency < 80
                    ? " (recommended)"
                    : " (high)"}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={consistency}
          onChange={(e) => setConsistency(parseInt(e.target.value, 10))}
          className="w-full accent-sky-400"
          disabled={submitting}
        />
        <p className="mt-1 text-[10px] text-zinc-300">
          Visual consistency across slides. 0 = varied independent images. 70 =
          recommended — same character appears throughout, locked seed for
          uniform composition, different scenes per narration beat.
        </p>
      </div>

      {/* Animation (i2v) — TubeGen-parity. Turns stills into MP4 clips
          post-scene-gen while preserving character identity. */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-zinc-300">
          Animation{" "}
          <span className="text-zinc-500">
            (TubeGen-style motion — preserves character)
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              value: "none" as const,
              label: "No animation",
              desc: "Stills + Ken Burns zoom",
              price: "FREE",
              emoji: "🖼️",
            },
            {
              value: "all" as const,
              label: "Animate all",
              desc: "Every scene → motion",
              price: `~$${(0.1125 * Math.ceil((duration * 60) / 6)).toFixed(2)}`,
              emoji: "🎬",
            },
            {
              value: "longer-only" as const,
              label: "Longer scenes only",
              desc: "Scenes ≥ 5s get motion",
              price: `~$${(0.1125 * Math.ceil((duration * 60) / 6) * 0.4).toFixed(2)}`,
              emoji: "⏱️",
            },
            {
              value: "per-scene" as const,
              label: "Per-scene (editor)",
              desc: "Pick in editor, AI auto-decides motion",
              price: "~$1-3 typ.",
              emoji: "✏️",
            },
          ].map((opt) => {
            const selected = animMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnimMode(opt.value)}
                disabled={submitting}
                className={`rounded-lg border p-3 text-left transition-all ${
                  selected
                    ? "border-fuchsia-400/70 bg-gradient-to-br from-fuchsia-500/25 to-fuchsia-500/5 shadow-[0_0_12px_rgba(232,121,249,0.3)]"
                    : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold ${
                      selected ? "text-fuchsia-300" : "text-zinc-300"
                    }`}
                  >
                    <span className="mr-1.5">{opt.emoji}</span>
                    {opt.label}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      selected
                        ? "bg-fuchsia-500/20 text-fuchsia-300"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {opt.price}
                  </span>
                </div>
                <p
                  className={`mt-1 text-[11px] ${
                    selected ? "text-fuchsia-200/80" : "text-zinc-500"
                  }`}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {animMode !== "none" ? (
          <div className="mt-3">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-fuchsia-300/90">
              ✦ Animation quality
            </label>
            <select
              value={animQuality}
              onChange={(e) =>
                setAnimQuality(
                  e.target.value as typeof animQuality,
                )
              }
              disabled={submitting}
              className="w-full cursor-pointer appearance-none rounded-lg border border-fuchsia-400/60 bg-gradient-to-br from-fuchsia-500/20 via-fuchsia-500/10 to-fuchsia-600/5 px-4 py-2.5 text-xs font-semibold tracking-wide text-fuchsia-100 shadow-[0_0_14px_rgba(217,70,239,0.28),0_0_32px_rgba(217,70,239,0.12)_inset] ring-1 ring-fuchsia-400/20 transition-all hover:border-fuchsia-300 hover:from-fuchsia-500/30 hover:shadow-[0_0_20px_rgba(217,70,239,0.45),0_0_44px_rgba(217,70,239,0.18)_inset] focus:border-fuchsia-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(217,70,239,0.20), rgba(217,70,239,0.10), rgba(168,85,247,0.05)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f0abfc' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                backgroundPosition: "right 12px center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "auto, 12px",
                paddingRight: "36px",
              }}
            >
              <optgroup label="Kling (fal.ai) — cartoon-friendly, no IP filter">
                <option value="kling-standard">
                  Kling Standard (720p, ~$0.18/clip) — recommended for cartoons
                </option>
                <option value="kling-pro">
                  Kling Pro (1080p, ~$0.30/clip) — best cartoon quality
                </option>
                <option value="kling-master">
                  Kling v2 Master (1080p flagship, ~$0.90/clip)
                </option>
                <option value="luma">
                  Luma Dream Machine (720p, ~$0.14/clip)
                </option>
              </optgroup>
              <optgroup label="Veo (Google) — photorealistic only, rejects cartoons">
                <option value="default">
                  Veo 3 Fast (720p, ~$0.11/clip)
                </option>
                <option value="default_1080p">
                  Veo 3 Fast 1080p (~$0.15/clip)
                </option>
                <option value="high">
                  Veo 3.1 High Cinematic (1080p, ~$0.35/clip)
                </option>
                <option value="turbo">Veo Turbo (720p, ~$0.11/clip)</option>
              </optgroup>
              <optgroup label="Modal Narrative (Calm — recommended for story/narration) ⭐">
                <option value="modal-wan22-narrative">
                  Wan2.2 Narrative L40S (~$0.32/scene, ~5 min) — default calm cartoon
                </option>
                <option value="modal-wan22-narrative-fast">
                  Wan2.2 Narrative H100 (~$0.40/scene, ~2 min)
                </option>
                <option value="modal-hunyuan-narrative">
                  HunyuanVideo 1.5 L40S (~$0.14/scene, ~3 min) — alternative calm
                </option>
                <option value="modal-hunyuan-narrative-fast">
                  HunyuanVideo 1.5 H100 (~$0.24/scene, ~1 min)
                </option>
              </optgroup>
              <optgroup label="Modal Action (Wan2.2 Fun-InP — energetic motion)">
                <option value="modal-wan22">
                  Wan2.2 Fun-InP L40S (~$0.32/scene, ~3 min) — action beats
                </option>
                <option value="modal-wan22-fast">
                  Wan2.2 Fun-InP H100 (~$0.40/scene, ~2 min) — fast action
                </option>
              </optgroup>
              <optgroup label="Local (free, on DGX — slow)">
                <option value="wan22-local">
                  Wan2.2 GB10 Local (free, ~15-20 min/clip) — batch only
                </option>
                <option value="ltx-local">
                  LTX Local (free, ~90s/clip) — fastest, lower quality
                </option>
              </optgroup>
            </select>
            <p className="mt-1 text-[10px] text-zinc-300">
              The AI auto-decides the right motion for each scene (looks
              at the image + narration beat). Override or re-roll any
              individual scene in the editor with ✨ Auto-suggest.
            </p>
          </div>
        ) : null}
      </div>

      {/* Image renderer — picks the model that draws the slides. Empty
          string falls back to the Style's defaultQuality; cloudRental still
          auto-picks firered-modal when this is empty. Explicit pick wins. */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
          Slide renderer{" "}
          <span className="font-normal text-zinc-500">
            (which model draws the images)
          </span>
        </label>
        <select
          value={imageQuality}
          onChange={(e) => setImageQuality(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 focus:border-sky-400/40 focus:outline-none"
        >
          <option value="">
            Auto — use Style&rsquo;s default (or cloud preset)
          </option>
          <optgroup label="DGX local — free, ~30s/scene">
            <option value="firered-local">
              FireRed local — cartoon (default)
            </option>
            <option value="sdxl-local">SDXL local — photoreal</option>
          </optgroup>
          <optgroup label="Cloud — fastest, parallelisable">
            <option value="firered-modal">
              FireRed Modal L40S (~$0.03/scene, ~20s)
            </option>
            <option value="firered-modal-fast">
              FireRed Modal H100 (~$0.05/scene, ~10s)
            </option>
            <option value="gemini-2k">
              Gemini 2K (~$0.04/scene, ~8s) — sharp text-friendly
            </option>
            <option value="gemini-1k">Gemini 1K (~$0.02/scene, ~6s)</option>
          </optgroup>
          <optgroup label="Cloud — Ideogram (best for text-in-image)">
            <option value="ideogram-turbo">
              Ideogram Turbo (~$0.05/scene)
            </option>
            <option value="ideogram-default">
              Ideogram Default (~$0.08/scene)
            </option>
            <option value="ideogram-quality">
              Ideogram Quality (~$0.10/scene)
            </option>
          </optgroup>
        </select>
        <p className="mt-1 text-[10px] text-zinc-400">
          Cloud renderers free up the DGX during long runs. Ideogram is the
          strongest at putting readable numbers/text inside the image.
        </p>
      </div>

      {/* Scene visuals — REMOVED 2026-04-22. All new projects start as SDXL
          stills (cheap, fast). Users pick per-scene animation quality in the
          editor using the Animation Quality button, so they never pay for a
          full video they end up disliking. Backend still accepts videoBackend;
          we pin it to "sdxl" for every creation. */}

      {/* Popular ElevenLabs voices — audition before cloning */}
      <YouTubePopularVoices />

      {/* Voice */}
      <YouTubeVoiceClonePanel
        mode="select"
        value={voiceCloneName}
        onChange={(name) => setVoiceCloneName(name)}
        autoPopulatedFrom={selectedStyleName}
      />

      {/* Background music */}
      <YouTubeMusicPicker
        value={backgroundMusicId}
        volume={musicVolume}
        onChange={(id, vol) => {
          setBackgroundMusicId(id);
          setMusicVolume(vol);
        }}
        disabled={submitting}
      />

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
        {!voiceCloneName && (
          <span className="text-[10px] text-amber-400">
            Pick a voice clone first
          </span>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-sky-500/20 px-6 py-2 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Starting pipeline..." : "Run creation"}
        </button>
      </div>
    </div>
  );
}
