"use client";

/**
 * "What are we creating?" gate.
 *
 * Rendered on YouTubeProjectDetail when project.status === "transcribed".
 * Collects the goal + length + style + voice + custom prompt, then POSTs
 * to /api/vater/youtube/[id]/context which flips status into
 * extracting_principles and kicks off /vater/run-creation.
 */

import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { YouTubeStylePicker } from "./youtube-style-picker";
import { YouTubeStyleDocumentPicker } from "./youtube-style-document-picker";
import { YouTubeVoiceClonePanel } from "./youtube-voice-clone-panel";
import { YouTubeGoalPicker } from "./youtube-goal-picker";
import { YouTubeMusicPicker } from "./youtube-music-picker";
import { YouTubeCreatorModelPicker } from "./youtube-creator-model-picker";
import {
  DEFAULT_STYLE_PRESET,
  isStylePresetId,
  type StylePresetId,
} from "@/lib/vater/style-presets";
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
  const initialStyle: StylePresetId = isStylePresetId(project.stylePreset)
    ? (project.stylePreset as StylePresetId)
    : DEFAULT_STYLE_PRESET;
  const [stylePreset, setStylePreset] = useState<StylePresetId>(initialStyle);
  const [customStylePrompt, setCustomStylePrompt] = useState(
    project.customStylePrompt ?? "",
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
  const [videoBackend, setVideoBackend] = useState<string>("sdxl");
  // Phase 1+ Style document — when set, takes precedence over stylePreset
  // and threads CustomArtStyle + characters + reference transcripts to DGX
  const [styleId, setStyleId] = useState<string | null>(null);
  const [creatorModelId, setCreatorModelId] = useState<CreatorModelId | null>(
    null,
  );
  const [activeCreatorModel, setActiveCreatorModel] =
    useState<CreatorModel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [regeneratingGoals, setRegeneratingGoals] = useState(false);

  const targetWordCount = useMemo(
    () => wordCountOverride ?? duration * WORDS_PER_MINUTE,
    [duration, wordCountOverride],
  );

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

  const canSubmit =
    goal.trim().length > 0 && !!voiceCloneName && !submitting;

  const handleCreatorModelChange = (model: CreatorModel | null) => {
    if (model) {
      setCreatorModelId(model.id as CreatorModelId);
      setActiveCreatorModel(model);
      // Apply recommended settings
      if (isStylePresetId(model.recommendedStylePreset)) {
        setStylePreset(model.recommendedStylePreset);
      }
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
            goal: goal.trim(),
            targetDuration: duration,
            targetWordCount,
            stylePreset,
            customStylePrompt: customStylePrompt.trim() || undefined,
            voiceCloneName,
            backgroundMusicId: backgroundMusicId ?? null,
            musicVolume,
            consistency,
            videoBackend,
            creatorModelId: creatorModelId ?? undefined,
            scriptGuidelines: activeCreatorModel?.scriptGuidelines ?? undefined,
            // Phase 1 — when set, the Style document overrides the legacy
            // preset path and threads characters + CustomArtStyle + ref
            // transcripts inline to the DGX worker.
            styleId: styleId ?? undefined,
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
        description: "Extracting principles + writing original script...",
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
      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">
          What are we creating?
        </h3>
        <p className="text-xs text-zinc-500">
          Transcript ready. Tell the pipeline what you want the final video
          to be — goal, length, visual style, and the voice clone to narrate
          it.
        </p>
      </div>

      {/* Transcript preview */}
      {transcript && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-600">
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
            Goal
          </label>
          <button
            type="button"
            onClick={handleRegenerateGoals}
            disabled={regeneratingGoals || submitting}
            className="text-[10px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
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
            <p className="mt-1 text-[10px] text-zinc-500">
              Overrides the picked template. Duration is still controlled by
              the slider below.
            </p>
          </div>
        </details>
      </div>

      {/* Duration + word count */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span>Target duration</span>
            <span className="text-[10px] font-normal text-zinc-600">
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
                className="text-[10px] font-normal text-zinc-600 underline-offset-2 hover:underline"
              >
                reset
              </button>
            )}
          </label>
          <input
            type="number"
            min={150}
            max={4500}
            step={50}
            value={targetWordCount}
            onChange={(e) =>
              setWordCountOverride(parseInt(e.target.value, 10) || null)
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 focus:border-sky-400/40 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-zinc-600">
            ~{Math.round(targetWordCount / WORDS_PER_MINUTE)} min at{" "}
            {WORDS_PER_MINUTE} wpm
          </p>
        </div>
      </div>

      {/* Scene consistency */}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-400">
          <span>Scene consistency</span>
          <span className="text-[10px] font-normal text-zinc-600">
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
        <p className="mt-1 text-[10px] text-zinc-600">
          Visual consistency across slides. 0 = varied independent images. 70 =
          recommended — same character appears throughout, locked seed for
          uniform composition, different scenes per narration beat.
        </p>
      </div>

      {/* Video backend */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-zinc-300">
          Scene visuals
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              value: "sdxl",
              label: "Standard",
              desc: "Still images + Ken Burns zoom",
              price: "FREE",
              emoji: "🖼️",
              accent: "emerald",
              selClass:
                "border-emerald-400/70 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 shadow-[0_0_12px_rgba(52,211,153,0.25)]",
              idleClass:
                "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/60 hover:bg-emerald-500/10",
              labelClass: "text-emerald-300",
              descClass: "text-emerald-200/80",
              priceClass: "text-emerald-300 bg-emerald-500/20",
            },
            {
              value: "veo-3.0-fast",
              label: "Veo 3 Fast",
              desc: "AI video clips",
              price: `~$${(0.1125 * Math.ceil((duration * 60) / 6)).toFixed(2)}`,
              emoji: "⚡",
              accent: "sky",
              selClass:
                "border-sky-400/70 bg-gradient-to-br from-sky-500/25 to-sky-500/5 shadow-[0_0_12px_rgba(56,189,248,0.3)]",
              idleClass:
                "border-sky-500/30 bg-sky-500/5 hover:border-sky-400/60 hover:bg-sky-500/10",
              labelClass: "text-sky-300",
              descClass: "text-sky-200/80",
              priceClass: "text-sky-300 bg-sky-500/20",
            },
            {
              value: "hybrid",
              label: "Hybrid",
              desc: "Hero scenes as video, rest as images",
              price: `~$${(0.1125 * Math.ceil(Math.ceil((duration * 60) / 6) * 0.2)).toFixed(2)}`,
              emoji: "🎬",
              accent: "amber",
              selClass:
                "border-amber-400/70 bg-gradient-to-br from-amber-500/25 to-amber-500/5 shadow-[0_0_12px_rgba(251,191,36,0.3)]",
              idleClass:
                "border-amber-500/30 bg-amber-500/5 hover:border-amber-400/60 hover:bg-amber-500/10",
              labelClass: "text-amber-300",
              descClass: "text-amber-200/80",
              priceClass: "text-amber-300 bg-amber-500/20",
            },
            {
              value: "veo-3.0",
              label: "Veo 3 Full",
              desc: "All scenes as AI video",
              price: `~$${(0.3 * Math.ceil((duration * 60) / 6)).toFixed(2)}`,
              emoji: "✨",
              accent: "fuchsia",
              selClass:
                "border-fuchsia-400/70 bg-gradient-to-br from-fuchsia-500/25 to-fuchsia-500/5 shadow-[0_0_12px_rgba(232,121,249,0.3)]",
              idleClass:
                "border-fuchsia-500/30 bg-fuchsia-500/5 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10",
              labelClass: "text-fuchsia-300",
              descClass: "text-fuchsia-200/80",
              priceClass: "text-fuchsia-300 bg-fuchsia-500/20",
            },
          ].map((opt) => {
            const selected = videoBackend === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVideoBackend(opt.value)}
                disabled={submitting}
                className={`rounded-lg border p-3 text-left transition-all ${
                  selected ? opt.selClass : opt.idleClass
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold ${opt.labelClass}`}
                  >
                    <span className="mr-1.5">{opt.emoji}</span>
                    {opt.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${opt.priceClass}`}
                  >
                    {opt.price}
                  </span>
                </div>
                <p className={`mt-1 text-[11px] leading-snug ${opt.descClass}`}>
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Style document picker — Phase 1+ path. When set, overrides the
          legacy preset below and threads CustomArtStyle + characters + ref
          transcripts inline to DGX (Layer 2 of resolve_effective_settings). */}
      <YouTubeStyleDocumentPicker value={styleId} onChange={setStyleId} />

      {/* Style */}
      <YouTubeStylePicker
        value={stylePreset}
        onChange={(id) => setStylePreset(id)}
        disabled={Boolean(styleId)}
      />

      {/* Custom style prompt */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">
          Custom style prompt
          <span className="ml-1 text-[10px] font-normal text-zinc-600">
            (optional override)
          </span>
        </label>
        <textarea
          value={customStylePrompt}
          onChange={(e) => setCustomStylePrompt(e.target.value)}
          placeholder="Override the preset with a free-form visual description"
          rows={2}
          maxLength={500}
          className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
        />
      </div>

      {/* Voice */}
      <YouTubeVoiceClonePanel
        mode="select"
        value={voiceCloneName}
        onChange={(name) => setVoiceCloneName(name)}
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
