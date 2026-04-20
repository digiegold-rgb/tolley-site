"use client";

import { useState, useMemo } from "react";

interface Props {
  script: string;
  targetWordCount: number;
  onSave: (script: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function YouTubeScriptEditor({
  script,
  targetWordCount,
  onSave,
  onRegenerate,
  isRegenerating,
}: Props) {
  const [editedScript, setEditedScript] = useState(script);
  const [editing, setEditing] = useState(false);

  const wordCount = useMemo(
    () => editedScript.split(/\s+/).filter(Boolean).length,
    [editedScript]
  );

  const deviation = Math.abs(wordCount - targetWordCount) / targetWordCount;
  const wordCountColor =
    deviation <= 0.05
      ? "text-emerald-400"
      : deviation <= 0.15
        ? "text-yellow-400"
        : "text-red-400";

  const hasChanges = editedScript !== script;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${wordCountColor}`}>
            {wordCount.toLocaleString()} / {targetWordCount.toLocaleString()}{" "}
            words
          </span>
          <span className="text-[10px] text-zinc-600">
            ~{Math.round(wordCount / 150)} min narration
          </span>
        </div>
        <div className="flex gap-2">
          {editing && hasChanges && (
            <button
              onClick={() => {
                onSave(editedScript);
                setEditing(false);
              }}
              className="rounded bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30"
            >
              Save
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="rounded bg-zinc-700/50 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="rounded bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-500/30 disabled:opacity-50"
          >
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={editedScript}
          onChange={(e) => setEditedScript(e.target.value)}
          className="h-64 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-300 leading-relaxed focus:border-sky-400/40 focus:outline-none"
        />
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
          {editedScript}
        </div>
      )}
    </div>
  );
}
