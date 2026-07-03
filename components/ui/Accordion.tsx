"use client";

import { useState, type ReactNode } from "react";

/**
 * Accordion primitive. Generalized port of
 * components/leads/dossier/CollapsibleSection.tsx so dossier and every other
 * surface share one collapsible shell.
 *
 * Supports:
 *  - Single or multiple open panels (type="single" | "multiple")
 *  - Controlled (value/onValueChange) or uncontrolled (defaultValue)
 *  - Per-item alert/highlight visual states
 */

export interface AccordionItemProps {
  id: string;
  title: ReactNode;
  children: ReactNode;
  count?: number;
  alert?: boolean;
  highlight?: boolean;
  badge?: ReactNode;
}

export function Accordion({
  items,
  type = "multiple",
  defaultOpen = [],
  value,
  onValueChange,
  className = "",
}: {
  items: AccordionItemProps[];
  type?: "single" | "multiple";
  defaultOpen?: string[];
  value?: string[];
  onValueChange?: (open: string[]) => void;
  className?: string;
}) {
  const [internal, setInternal] = useState<string[]>(defaultOpen);
  const open = value ?? internal;

  const toggle = (id: string) => {
    let next: string[];
    if (open.includes(id)) {
      next = open.filter((x) => x !== id);
    } else {
      next = type === "single" ? [id] : [...open, id];
    }
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        const wrapperClasses = item.highlight
          ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
          : item.alert
          ? "bg-red-500/5 border-red-500/20"
          : "bg-white/5 border-white/10";
        return (
          <div
            key={item.id}
            className={`rounded-xl border transition-all duration-300 ${wrapperClasses}`}
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/80">
                  {item.title}
                </span>
                {item.count != null && item.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.alert
                        ? "bg-red-500/20 text-red-300"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {item.badge}
                {item.highlight && (
                  <span className="animate-pulse rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                    NEW
                  </span>
                )}
              </div>
              <span className="text-sm text-white/30">{isOpen ? "\u2212" : "+"}</span>
            </button>
            {isOpen && <div className="px-4 pb-4">{item.children}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default Accordion;
