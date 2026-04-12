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
import { YouTubeVoiceClonePanel } from "./youtube-voice-clone-panel";
import {
  DEFAULT_STYLE_PRESET,
  isStylePresetId,
  type StylePresetId,
} from "@/lib/vater/style-presets";

const WORDS_PER_MINUTE = 150;
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
  const [submitting, setSubmitting] = useState(false);

  const targetWordCount = useMemo(
    () => wordCountOverride ?? duration * WORDS_PER_MINUTE,
    [duration, wordCountOverride],
  );

  const transcript = project.transcript ?? "";
  const transcriptPreview = transcript.slice(0, 500);
  const hasMoreTranscript = transcript.length > 500;

  const canSubmit =
    goal.trim().length > 0 && !!voiceCloneName && !submitting;

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

      {/* Goal */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">
          Goal
        </label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. 5-minute original explainer in my voice that re-frames the source's core argument for a beginner audience"
          rows={3}
          maxLength={500}
          className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
        />
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

      {/* Style */}
      <YouTubeStylePicker
        value={stylePreset}
        onChange={(id) => setStylePreset(id)}
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
