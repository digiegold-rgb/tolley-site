'use client';

/* ToastHost — app-wide toast queue for the studio shell (2026-08-28).
 *
 * Lifted out of Shell.tsx, where a single `toast` useState only the Shell
 * could set meant nothing else in the tree (the progress poller, a step
 * action) had a way to say "your script is ready". Now:
 *
 *   <ToastHost>            context + queue (mount ABOVE the ThemeProvider —
 *                          it renders nothing itself)
 *   <ToastViewport />      the bottom-centre stack (mount INSIDE the theme so
 *                          it wears the right palette)
 *   useToast()             { toast(message, {kind, onClick}), dismiss(id) }
 *
 * Queue ≤ 3 (oldest drops), 6 s auto-dismiss, optional onClick. Same look as
 * the old `Toast` primitive; the primitive stays for screens that still own a
 * local toast.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { Icon } from './Icon';
import type { ToastKind } from './primitives';

export interface ToastOptions {
  kind?: ToastKind;
  /** Click anywhere on the toast (not the ✕) — e.g. jump to the step. */
  onClick?: () => void;
  /** ms; 0 = sticky until dismissed. Default 6000. */
  duration?: number;
}

export interface ToastItem extends Required<Pick<ToastOptions, 'kind' | 'duration'>> {
  id: number;
  message: string;
  onClick?: () => void;
}

export interface ToastContextValue {
  items: ToastItem[];
  toast: (message: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const MAX_TOASTS = 3;
const DEFAULT_MS = 6000;

const noopValue: ToastContextValue = { items: [], toast: () => 0, dismiss: () => {} };
export const ToastContext = React.createContext<ToastContextValue>(noopValue);

export function useToast(): ToastContextValue {
  return React.useContext(ToastContext);
}

let nextId = 1;

export function ToastHost({ children }: { children: React.ReactNode }): React.ReactElement {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toast = React.useCallback((message: string, opts: ToastOptions = {}): number => {
    const id = nextId++;
    const item: ToastItem = {
      id,
      message,
      kind: opts.kind ?? 'info',
      duration: opts.duration ?? DEFAULT_MS,
      onClick: opts.onClick,
    };
    setItems((prev) => [...prev, item].slice(-MAX_TOASTS));
    return id;
  }, []);

  const value = React.useMemo<ToastContextValue>(() => ({ items, toast, dismiss }), [items, toast, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }): React.ReactElement {
  const { t } = useTheme();

  React.useEffect(() => {
    if (!item.duration) return;
    const h = window.setTimeout(onDismiss, item.duration);
    return () => window.clearTimeout(h);
  }, [item.duration, onDismiss]);

  const accent =
    item.kind === 'success'
      ? JELLY_TOKENS.success
      : item.kind === 'error'
        ? JELLY_TOKENS.error
        : JELLY_TOKENS.brand;

  const clickable = !!item.onClick;

  return (
    <div
      role={clickable ? 'button' : 'status'}
      tabIndex={clickable ? 0 : undefined}
      aria-live="polite"
      data-testid="toast"
      data-kind={item.kind}
      onClick={() => {
        if (!item.onClick) return;
        item.onClick();
        onDismiss();
      }}
      onKeyDown={(e) => {
        if (!item.onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.onClick();
          onDismiss();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'min(560px, calc(100vw - 32px))',
        padding: '12px 16px',
        borderRadius: JELLY_TOKENS.radius.lg,
        background: t.panel,
        color: t.text,
        border: `1px solid ${t.borderStrong}`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: JELLY_TOKENS.shadow4,
        backdropFilter: t.glassBlur,
        fontSize: 14,
        fontFamily: JELLY_TOKENS.font,
        cursor: clickable ? 'pointer' : 'default',
        pointerEvents: 'auto',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{item.message}</span>
      {clickable && <span style={{ fontSize: 12, color: JELLY_TOKENS.cyan, whiteSpace: 'nowrap' }}>Open →</span>}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          color: t.textSecondary,
        }}
      >
        <Icon name="close" size={16} color={t.textSecondary} />
      </button>
    </div>
  );
}

/** The fixed bottom-centre stack. Mount once, inside the ThemeProvider. */
export function ToastViewport(): React.ReactElement | null {
  const { items, dismiss } = useToast();
  if (items.length === 0) return null;
  return (
    <div
      data-testid="toast-viewport"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  );
}
