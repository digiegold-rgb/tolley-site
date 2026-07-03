"use client";

/**
 * Creator Model picker — lets the user select a channel-level DNA template
 * that pre-configures style, duration, goals, and script guidelines.
 *
 * When a model is selected, the parent form receives the full CreatorModel
 * object and can apply its recommendations to the style picker, goal picker,
 * and duration slider.
 */

import { useState } from "react";
import {
  CREATOR_MODELS,
  type CreatorModel,
  type CreatorModelId,
} from "@/lib/vater/creator-models";

interface Props {
  value: CreatorModelId | null;
  onChange: (model: CreatorModel | null) => void;
  disabled?: boolean;
}

export function YouTubeCreatorModelPicker({
  value,
  onChange,
  disabled,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleSelect = (model: CreatorModel) => {
    if (disabled) return;
    if (value === model.id) {
      onChange(null); // deselect
    } else {
      onChange(model);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Creator Model</span>
        <span className="text-[10px] text-zinc-600">
          {CREATOR_MODELS.length} available
        </span>
      </div>
      <p className="mb-3 text-[10px] text-zinc-600">
        Select a creator model to auto-configure style, goals, and script
        voice based on a proven channel format. Optional — leave unselected
        for freestyle.
      </p>
      <div
        className={`space-y-3 ${disabled ? "pointer-events-none opacity-40" : ""}`}
      >
        {CREATOR_MODELS.map((model) => {
          const isSelected = model.id === value;
          const isExpanded = expanded === model.id;
          return (
            <div
              key={model.id}
              className={`overflow-hidden rounded-lg border transition-all ${
                isSelected
                  ? "border-sky-400 bg-sky-400/10 ring-2 ring-sky-400/30 shadow-[0_0_16px_rgba(56,189,248,0.2)]"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelect(model)}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-lg">
                  🎬
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? "text-sky-400" : "text-zinc-200"
                      }`}
                    >
                      {model.name}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-semibold text-zinc-400">
                      {model.subscribers}
                    </span>
                    {isSelected && (
                      <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-bold text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {model.tagline}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                    {model.description}
                  </p>
                </div>
              </button>

              {/* Expandable detail */}
              <div className="border-t border-zinc-800/50 px-4 py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(isExpanded ? null : model.id);
                  }}
                  className="w-full py-1 text-left text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  {isExpanded ? "Hide details" : "Show principles & formulas"}
                </button>
              </div>

              {isExpanded && (
                <div className="space-y-3 border-t border-zinc-800/50 px-4 py-3">
                  {/* Content pillars */}
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Content Pillars
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {model.contentPillars.map((pillar) => (
                        <span
                          key={pillar}
                          className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                        >
                          {pillar}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Principles */}
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Extracted Principles ({model.principles.length})
                    </p>
                    <ol className="space-y-1">
                      {model.principles.map((p, i) => (
                        <li
                          key={i}
                          className="text-[10px] leading-relaxed text-zinc-400"
                        >
                          <span className="mr-1 font-semibold text-zinc-500">
                            {i + 1}.
                          </span>
                          {p}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Title formulas */}
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Title Formulas ({model.titleFormulas.length})
                    </p>
                    <div className="space-y-2">
                      {model.titleFormulas.map((formula) => (
                        <div key={formula.id}>
                          <p className="text-[10px] font-semibold text-zinc-300">
                            {formula.name}:{" "}
                            <span className="font-mono font-normal text-sky-400/80">
                              {formula.pattern}
                            </span>
                          </p>
                          <ul className="mt-0.5 space-y-0.5 pl-3">
                            {formula.examples.slice(0, 3).map((ex, j) => (
                              <li
                                key={j}
                                className="text-[9px] text-zinc-500"
                              >
                                {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended settings */}
                  <div className="flex gap-4 text-[10px] text-zinc-500">
                    <span>
                      Style:{" "}
                      <span className="text-zinc-300">
                        {model.recommendedStylePreset}
                      </span>
                    </span>
                    <span>
                      Duration:{" "}
                      <span className="text-zinc-300">
                        {model.recommendedDuration} min
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
