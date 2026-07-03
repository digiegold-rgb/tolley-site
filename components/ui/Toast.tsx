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
 * Top-right toast queue. Wrap the app in <ToastProvider> and call useToast()
 * from anywhere to show a transient message.
 *
 *   const { toast } = useToast();
 *   toast({ title: "Saved", variant: "success" });
 */

type ToastVariant = "default" | "success" | "error" | "warning";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastCtx {
  toast: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastCtx["toast"]>(
    (t) => {
      const id = ++toastCounter;
      const item: ToastItem = { id, duration: 4000, variant: "default", ...t };
      setItems((prev) => [...prev, item]);
      if (item.duration) {
        setTimeout(() => dismiss(id), item.duration);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const variantClass = {
    default: "border-white/10 bg-[#0b0a12]/95",
    success: "border-emerald-500/30 bg-emerald-500/10",
    error: "border-red-500/30 bg-red-500/10",
    warning: "border-yellow-500/30 bg-yellow-500/10",
  }[item.variant ?? "default"];

  return (
    <div
      role="status"
      className={`pointer-events-auto rounded-xl border p-3 shadow-2xl backdrop-blur ${variantClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white/90">{item.title}</div>
          {item.description && (
            <div className="mt-0.5 text-xs text-white/60">{item.description}</div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white/80"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Stable no-op fallback used when <ToastProvider> isn't mounted. MUST be a
// module-level singleton — returning a fresh object literal from useToast()
// caused infinite re-renders for components that put `toast` in a useEffect
// dependency array (caught during VATER YouTube verification 2026-04-10).
const NOOP_TOAST: ToastCtx = {
  toast: () => {},
  dismiss: () => {},
};

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  return ctx ?? NOOP_TOAST;
}

export default ToastProvider;
