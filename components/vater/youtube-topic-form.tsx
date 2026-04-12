"use client";

/**
 * Tubegen-style topic-mode entry form.
 *
 * Skips fetch + transcribe entirely — straight from a topic prompt to the
 * full creation pipeline. Posts to /api/vater/topic which spawns a project
 * with mode="topic" and kicks off /vater/run-creation on the autopilot.
 */

import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { YouTubeStylePicker } from "./youtube-style-picker";
import { YouTubeVoiceClonePanel } from "./youtube-voice-clone-panel";
import {
  DEFAULT_STYLE_PRESET,
  type StylePresetId,
} from "@/lib/vater/style-presets";

const WORDS_PER_MINUTE = 150;
const MIN_DURATION = 1;
const MAX_DURATION = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreatedProject = any;

interface Props {
  onProjectCreated?: (project: CreatedProject) => void;
}

export function YouTubeTopicForm({ onProjectCreated }: Props) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState(10);
  const [wordCountOverride, setWordCountOverride] = useState<number | null>(
    null,
  );
  const [stylePreset, setStylePreset] =
    useState<StylePresetId>(DEFAULT_STYLE_PRESET);
  const [customStylePrompt, setCustomStylePrompt] = useState("");
  const [voiceCloneName, setVoiceCloneName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetWordCount = useMemo(
    () => wordCountOverride ?? duration * WORDS_PER_MINUTE,
    [duration, wordCountOverride],
  );

  const canSubmit =
    topic.trim().length > 0 &&
    goal.trim().length > 0 &&
    !!voiceCloneName &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/vater/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          goal: goal.trim(),
          targetDuration: duration,
          targetWordCount,
          stylePreset,
          customStylePrompt: customStylePrompt.trim() || undefined,
          voiceCloneName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast({
        title: "Project created",
        description: "Topic-mode pipeline started",
        variant: "success",
      });
      onProjectCreated?.(data.project);
      // reset form
      setTopic("");
      setGoal("");
      setWordCountOverride(null);
      setCustomStylePrompt("");
    } catch (err) {
      toast({
        title: "Could not create project",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vater-card p-6">
      <h3 className="mb-1 text-lg font-semibold text-zinc-200">
        New topic-mode project
      </h3>
      <p className="mb-5 text-xs text-zinc-500">
        Tubegen-style: type a topic, pick a style + voice, and the pipeline
        writes an original long-form script from scratch — no source video
        needed.
      </p>

      <div className="space-y-5">
        {/* Topic */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">
            Topic
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The economic history of the Suez Canal — why it matters today, who controls it, and the recent disruptions to global shipping..."
            rows={5}
            maxLength={1000}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-zinc-600">
            {topic.length} / 1000
          </p>
        </div>

        {/* Goal */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">
            Goal
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. 10-minute explainer in my voice for a curious audience"
            maxLength={300}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
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
              ~{Math.round(targetWordCount / WORDS_PER_MINUTE)} min narration
              at {WORDS_PER_MINUTE} wpm
            </p>
          </div>
        </div>

        {/* Style picker */}
        <YouTubeStylePicker
          value={stylePreset}
          onChange={(id) => setStylePreset(id)}
        />

        {/* Custom style prompt (optional) */}
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

        {/* Voice clone */}
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
            {submitting ? "Starting pipeline..." : "Start project"}
          </button>
        </div>
      </div>
    </div>
  );
}
