"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UndoToast = { id: number; label: string; until: number };

// Client-side delayed commit: the destructive API call only fires after ttlMs.
// Undo cancels it (state was only changed optimistically — rollback refetches).
// pagehide / tab-hide flushes pending commits immediately so closing the phone
// browser can't lose a delete — commit fns should use fetch(..., {keepalive: true}).
export function useUndoable(ttlMs = 8000) {
  const [toasts, setToasts] = useState<UndoToast[]>([]);
  const actions = useRef(new Map<number, { commit: () => void; rollback: () => void; timer: ReturnType<typeof setTimeout> }>());
  const nextId = useRef(1);

  const finish = useCallback((id: number, doCommit: boolean) => {
    const a = actions.current.get(id);
    if (!a) return;
    clearTimeout(a.timer);
    actions.current.delete(id);
    setToasts((t) => t.filter((x) => x.id !== id));
    if (doCommit) a.commit(); else a.rollback();
  }, []);

  const queue = useCallback((label: string, commit: () => void, rollback: () => void) => {
    const id = nextId.current++;
    const timer = setTimeout(() => finish(id, true), ttlMs);
    actions.current.set(id, { commit, rollback, timer });
    setToasts((t) => [...t, { id, label, until: Date.now() + ttlMs }]);
  }, [finish, ttlMs]);

  useEffect(() => {
    const flush = () => {
      for (const a of actions.current.values()) { clearTimeout(a.timer); a.commit(); }
      actions.current.clear();
      setToasts([]);
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return { toasts, queue, undo: (id: number) => finish(id, false) };
}

export function Toasts({ toasts, onUndo }: { toasts: UndoToast[]; onUndo: (id: number) => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!toasts.length) return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [toasts.length]);
  if (!toasts.length) return null;
  return (
    <div style={T.wrap}>
      {toasts.map((t) => {
        const left = Math.max(0, Math.ceil((t.until - Date.now()) / 1000));
        return (
          <div key={t.id} style={T.toast}>
            <span style={T.label}>{t.label}</span>
            <button onClick={() => onUndo(t.id)} style={T.undoBtn}>↩ Undo ({left}s)</button>
          </div>
        );
      })}
    </div>
  );
}

const T: Record<string, any> = {
  wrap: { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(76px + env(safe-area-inset-bottom))", zIndex: 70, display: "flex", flexDirection: "column", gap: 8, maxWidth: "94vw" },
  toast: { display: "flex", alignItems: "center", gap: 12, background: "#101725", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "10px 14px", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" },
  label: { fontSize: 13, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "56vw" },
  undoBtn: { minHeight: 38, fontSize: 13, fontWeight: 800, color: "#fcd34d", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 9, padding: "0 14px", cursor: "pointer", whiteSpace: "nowrap" },
};
