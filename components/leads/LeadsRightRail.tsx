"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Context + slot for the optional right-hand rail. Pages that want a
 * contextual side panel call useContextRail().setContent(node) on mount.
 * The layout renders whatever the active page has pushed.
 */

interface RailCtx {
  content: ReactNode | null;
  setContent: (node: ReactNode | null) => void;
}

const Ctx = createContext<RailCtx | null>(null);

export function LeadsRightRailProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [content, setContentState] = useState<ReactNode | null>(null);
  const setContent = useCallback((node: ReactNode | null) => {
    setContentState(node);
  }, []);
  const value = useMemo(() => ({ content, setContent }), [content, setContent]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContextRail() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return { content: null, setContent: () => {} };
  }
  return ctx;
}

export function LeadsRightRailSlot() {
  const { content } = useContextRail();
  if (!content) return null;
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-[#06050a] p-4 xl:block">
      {content}
    </aside>
  );
}
