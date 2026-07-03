"use client";

/**
 * Goal picker — the upgrade from a free-text goal textarea to a visual
 * card grid with an AI-suggested section on top and a static template
 * library below.
 *
 * CRITICAL RULE: Selecting a card ONLY fills the goal text. The user
 * controls duration + word count on their own sliders elsewhere on the
 * form. See memory/feedback_goal_vs_duration_separation.md.
 */

import { useMemo } from "react";
import { GOAL_TEMPLATES, type GoalTemplate } from "@/lib/vater/goal-templates";

interface Props {
  /** AI-generated per-video suggestions. May be empty if the goal step failed. */
  suggestions: GoalTemplate[];
  /** Currently selected template (or null if the user hasn't picked yet). */
  value: GoalTemplate | null;
  /** Called when the user picks a card. */
  onChange: (template: GoalTemplate) => void;
  /** Dim + disable the whole grid, e.g. while the form is submitting. */
  disabled?: boolean;
}

export function YouTubeGoalPicker({
  suggestions,
  value,
  onChange,
  disabled,
}: Props) {
  // Defensive: AI suggestions may arrive with stray `duration` / `wordCount`
  // fields despite the system prompt. Drop anything that isn't a valid card.
  const cleanSuggestions = useMemo(
    () => suggestions.filter((s) => s && s.id && s.title && s.goalText),
    [suggestions],
  );

  return (
    <div className={disabled ? "pointer-events-none opacity-40" : ""}>
      {cleanSuggestions.length > 0 && (
        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <span aria-hidden="true">✨ </span>Based on your video
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cleanSuggestions.map((tpl) => (
              <GoalCard
                key={`suggested-${tpl.id}`}
                template={tpl}
                selected={
                  value?.source === "suggested" && value.id === tpl.id
                }
                onClick={() => onChange(tpl)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Templates
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GOAL_TEMPLATES.map((tpl) => (
            <GoalCard
              key={`template-${tpl.id}`}
              template={tpl}
              selected={value?.source === "template" && value.id === tpl.id}
              onClick={() => onChange(tpl)}
            />
          ))}
        </div>
      </section>

      {value && <GoalPreviewPanel template={value} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

interface CardProps {
  template: GoalTemplate;
  selected: boolean;
  onClick: () => void;
}

function GoalCard({ template, selected, onClick }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex min-h-[104px] flex-col gap-1.5 rounded-lg border p-3 text-left transition-all ${
        selected
          ? "border-sky-400 bg-sky-400/5 ring-2 ring-sky-400/30 shadow-[0_0_14px_rgba(56,189,248,0.2)]"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/60"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none" aria-hidden="true">
          {template.emoji}
        </span>
        <span
          className={`text-sm font-semibold ${
            selected ? "text-sky-400" : "text-zinc-200"
          }`}
        >
          {template.title}
        </span>
      </div>
      {template.subtitle && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
          {template.subtitle}
        </p>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Preview panel                                                       */
/* ------------------------------------------------------------------ */

function GoalPreviewPanel({ template }: { template: GoalTemplate }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl leading-none" aria-hidden="true">
          {template.emoji}
        </span>
        <span className="text-sm font-semibold text-zinc-100">
          {template.title}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-600">
          {template.source === "suggested" ? "AI suggestion" : "Template"}
        </span>
      </div>
      {template.subtitle && (
        <p className="mb-2 text-xs text-zinc-400">{template.subtitle}</p>
      )}
      {template.preview && (
        <p className="text-[11px] leading-relaxed text-zinc-300">
          <span className="text-zinc-500">What this creates: </span>
          {template.preview}
        </p>
      )}
      <details className="mt-3 border-t border-zinc-800/60 pt-2">
        <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
          ▸ Show prompt
        </summary>
        <pre className="mt-2 whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950/70 p-2 font-mono text-[10px] leading-relaxed text-zinc-400">
          {template.goalText}
        </pre>
      </details>
    </div>
  );
}
