"use client";

import { useId, type ReactNode } from "react";

/**
 * CSS-only tooltip. Shows on hover/focus-visible of the wrapped element.
 * Uses `group` + `group-hover`/`group-focus-within` so no JS state needed.
 *
 *   <Tooltip label="Build dossier">
 *     <button>...</button>
 *   </Tooltip>
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const id = useId();

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  }[side];

  return (
    <span
      className={`group relative inline-flex ${className}`}
      aria-describedby={id}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-50 ${sideClasses} whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-xs text-white/80 opacity-0 shadow-lg backdrop-blur transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}

export default Tooltip;
