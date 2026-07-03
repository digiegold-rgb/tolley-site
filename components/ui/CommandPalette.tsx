"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { KeyHint } from "./KeyHint";

/**
 * Hand-rolled command palette. Cmd+K opens; fuzzy matches a command registry;
 * Enter executes. Also exposes a context so the AI chat pane and Quick
 * Actions grid can share the same command catalog.
 *
 * Mount <CommandPaletteProvider commands={...}> once near the root of the
 * T-Agent layout. Trigger opening via the global hotkey (auto) or
 * programmatically via useCommandPalette().open().
 */

export interface Command {
  id: string;
  title: string;
  /** Extra keywords for fuzzy match (joined with title). */
  keywords?: string[];
  /** Group heading shown in the palette. */
  group?: string;
  /** Icon rendered on the left of the item. */
  icon?: ReactNode;
  /** Keyboard shortcut label for display only. */
  shortcut?: string[];
  /** Action invoked when selected. Receives a close() callback. */
  run: (ctx: { close: () => void }) => void | Promise<void>;
}

interface CommandPaletteCtx {
  open: (initialQuery?: string) => void;
  close: () => void;
  toggle: () => void;
  runById: (id: string) => void;
  commands: Command[];
}

const Ctx = createContext<CommandPaletteCtx | null>(null);

export function CommandPaletteProvider({
  commands,
  children,
}: {
  commands: Command[];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");

  const open = useCallback((initialQuery?: string) => {
    setPendingQuery(initialQuery ?? "");
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setPendingQuery("");
  }, []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const runById = useCallback(
    (id: string) => {
      const cmd = commands.find((c) => c.id === id);
      if (cmd) cmd.run({ close });
    },
    [commands, close]
  );

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      if (isModifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo(
    () => ({ open, close, toggle, runById, commands }),
    [open, close, toggle, runById, commands]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen && (
        <CommandPaletteOverlay
          commands={commands}
          onClose={close}
          initialQuery={pendingQuery}
        />
      )}
    </Ctx.Provider>
  );
}

export function useCommandPalette(): CommandPaletteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      open: () => {},
      close: () => {},
      toggle: () => {},
      runById: () => {},
      commands: [],
    };
  }
  return ctx;
}

function score(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500;
  const idx = t.indexOf(q);
  if (idx >= 0) return 200 - idx;
  // subsequence match
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 50 - (t.length - q.length) : 0;
}

function CommandPaletteOverlay({
  commands,
  onClose,
  initialQuery = "",
}: {
  commands: Command[];
  onClose: () => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands
      .map((c) => {
        const hay = [c.title, ...(c.keywords ?? [])].join(" ");
        return { cmd: c, score: score(query, hay) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.cmd);
  }, [query, commands]);

  // Reset active index when filter changes
  useEffect(() => {
    setActive(0);
  }, [query]);

  // Group filtered commands
  const grouped = useMemo(() => {
    const groups = new Map<string, Command[]>();
    for (const c of filtered) {
      const g = c.group ?? "Commands";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(c);
    }
    // Flatten back out into [group?, cmd] entries for rendering + indexing
    const flat: Array<{ kind: "header"; label: string } | { kind: "item"; cmd: Command; index: number }> = [];
    let i = 0;
    for (const [label, items] of groups.entries()) {
      flat.push({ kind: "header", label });
      for (const cmd of items) {
        flat.push({ kind: "item", cmd, index: i++ });
      }
    }
    return { flat, count: i };
  }, [filtered]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(grouped.count - 1, a + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[active];
      if (cmd) {
        void cmd.run({ close: onClose });
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0b0a12] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white/40"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <KeyHint keys={["Esc"]} />
        </div>
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto p-1"
          role="listbox"
        >
          {grouped.count === 0 && (
            <div className="px-3 py-8 text-center text-sm text-white/30">
              No commands match "{query}"
            </div>
          )}
          {grouped.flat.map((entry, i) => {
            if (entry.kind === "header") {
              return (
                <div
                  key={`h-${i}`}
                  className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-white/30"
                >
                  {entry.label}
                </div>
              );
            }
            const isActive = entry.index === active;
            return (
              <button
                key={entry.cmd.id}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(entry.index)}
                onClick={() => void entry.cmd.run({ close: onClose })}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5"
                }`}
              >
                {entry.cmd.icon && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white/50">
                    {entry.cmd.icon}
                  </span>
                )}
                <span className="flex-1 truncate">{entry.cmd.title}</span>
                {entry.cmd.shortcut && <KeyHint keys={entry.cmd.shortcut} />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[11px] text-white/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <KeyHint keys={["↑", "↓"]} /> navigate
            </span>
            <span className="flex items-center gap-1">
              <KeyHint keys={["↵"]} /> select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <KeyHint keys={["Cmd", "K"]} /> toggle
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPaletteProvider;
