'use client';

/**
 * Force Kill — red control on Create (and Progress when a project is open).
 *
 * Confirm POSTs /cancel (DGX stops; leftover jobs count as already stopped)
 * then DELETE the row. The caller clears `p=` and lands on `#r=create&s=1`.
 * Soft-reset to `transcribed` is not the product outcome.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { ApiError, createApi, errorMessage } from './create-api';

export const FORCE_KILL_COPY =
  'This will kill all current and future steps. You will need to regenerate from step one.';

/** Cancel first (best-effort stop), then delete. 404 = already gone. */
export async function forceKillProject(id: string): Promise<void> {
  try {
    await createApi.cancel(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
    // 404 or leftover DGX miss — DELETE is still the kill
  }
  try {
    await createApi.deleteProject(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return;
    throw err;
  }
}

export function ForceKillControl({
  projectId,
  onKilled,
  compact,
}: {
  projectId: string;
  onKilled: () => void;
  compact?: boolean;
}): React.ReactElement {
  const { t } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const confirm = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await forceKillProject(projectId);
      setOpen(false);
      onKilled();
    } catch (err) {
      setError(errorMessage(err, 'Could not kill this project'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 'none' }} data-testid="force-kill-wrap">
      <button
        type="button"
        data-testid="force-kill"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setError(null);
          setOpen((v) => !v);
        }}
        style={{
          fontFamily: JELLY_TOKENS.font,
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          padding: compact ? '5px 10px' : '6px 12px',
          borderRadius: JELLY_TOKENS.radius.md,
          border: `1px solid ${JELLY_TOKENS.error}`,
          background: 'rgba(240,96,122,0.14)',
          color: JELLY_TOKENS.error,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
          boxShadow: '0 0 10px rgba(240,96,122,0.22)',
        }}
      >
        {busy ? 'Killing…' : 'Force Kill'}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Force Kill"
          data-testid="force-kill-tab"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 20,
            width: 300,
            padding: 14,
            background: t.panel,
            border: `1px solid ${JELLY_TOKENS.error}66`,
            borderRadius: JELLY_TOKENS.radius.lg,
            boxShadow: JELLY_TOKENS.shadow24,
            fontFamily: JELLY_TOKENS.font,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55 }}>{FORCE_KILL_COPY}</div>
          {error && (
            <div data-testid="force-kill-error" style={{ marginTop: 8, fontSize: 12, color: JELLY_TOKENS.error }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <VBtn
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
              data-testid="force-kill-cancel"
            >
              Cancel
            </VBtn>
            <VBtn
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => void confirm()}
              data-testid="force-kill-confirm"
            >
              {busy ? 'Killing…' : 'Confirm'}
            </VBtn>
          </div>
        </div>
      )}
    </div>
  );
}
