"use client";

import type { Section } from "./types";

export function CollapsibleSection({
  title,
  section,
  expanded,
  toggle,
  count,
  alert,
  highlight,
  children,
}: {
  title: string;
  section: Section;
  expanded: Set<Section>;
  toggle: (s: Section) => void;
  count?: number;
  alert?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const isExpanded = expanded.has(section);

  return (
    <div
      className={`rounded-xl border transition-all duration-500 ${
        highlight
          ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
          : alert
          ? "bg-red-500/5 border-red-500/20"
          : "bg-white/5 border-white/10"
      }`}
    >
      <button
        onClick={() => toggle(section)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">{title}</span>
          {count != null && count > 0 && (
            <span
              className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                alert
                  ? "bg-red-500/20 text-red-300"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {count}
            </span>
          )}
          {highlight && (
            <span className="text-xs rounded-full bg-blue-500/20 text-blue-300 px-2 py-0.5 animate-pulse">
              NEW
            </span>
          )}
        </div>
        <span className="text-white/30 text-sm">
          {isExpanded ? "\u2212" : "+"}
        </span>
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
