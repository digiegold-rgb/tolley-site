'use client';

/* DriveSyncChip — "Saved to Drive ↗" for a project row (2026-08-28).
 *
 * Approve mirrors the script to the customer's Google Drive server-side; the
 * row then carries `driveFileUrl` (or `driveError`). This chip reads ONLY the
 * row — no status fetch — so it is free to render on every Progress line.
 *
 *   no data          → nothing (not linked, or not approved yet)
 *   driveFileUrl     → "Saved to Drive ↗" link
 *   driveError       → amber "Drive save failed · Retry" → POST drive-sync,
 *                      then `onSynced(row)` so the host adopts the new row
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { TINT_BG, TINT_BORDER } from './screens/tint';
import { createApi, ApiError, errorMessage, type CreateProject } from './screens/create/create-api';

export interface DriveSyncChipProject {
  id: string;
  driveFileUrl?: string | null;
  driveError?: string | null;
}

export function DriveSyncChip({
  project,
  compact = false,
  onSynced,
  style,
}: {
  project: DriveSyncChipProject;
  /** Progress rows: smaller type, no reason text. */
  compact?: boolean;
  /** Called with the row drive-sync returned (200 even on a failed save). */
  onSynced?: (row: CreateProject) => void;
  style?: React.CSSProperties;
}): React.ReactElement | null {
  const { t } = useTheme();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  // Optimistic local view of the row until the host re-reads it.
  const [local, setLocal] = React.useState<{ url: string | null; error: string | null } | null>(null);

  React.useEffect(() => {
    setLocal(null);
    setErr(null);
  }, [project.id, project.driveFileUrl, project.driveError]);

  const url = local ? local.url : project.driveFileUrl ?? null;
  const failed = local ? local.error : project.driveError ?? null;

  if (!url && !failed) return null;

  const retry = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const row = await createApi.driveSync(project.id);
      setLocal({ url: row.driveFileUrl ?? null, error: row.driveError ?? null });
      onSynced?.(row);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 412) setErr('Link Google Drive first (step 5).');
      else setErr(errorMessage(e2, 'Could not save to Drive'));
    } finally {
      setBusy(false);
    }
  };

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: compact ? 11 : 12,
    fontWeight: 600,
    letterSpacing: '0.02em',
    padding: compact ? '2px 8px' : '4px 10px',
    borderRadius: JELLY_TOKENS.radius.pill,
    fontFamily: JELLY_TOKENS.font,
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
    ...style,
  };

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="drive-chip"
        data-state="saved"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...base,
          color: JELLY_TOKENS.success,
          ...TINT_BG.success,
          border: `1px solid ${TINT_BORDER.success}`,
          textDecoration: 'none',
        }}
      >
        Saved to Drive ↗
      </a>
    );
  }

  return (
    <span
      data-testid="drive-chip"
      data-state="failed"
      title={compact ? failed ?? undefined : undefined}
      style={{
        ...base,
        color: JELLY_TOKENS.warning,
        ...TINT_BG.warning,
        border: `1px solid ${TINT_BORDER.warning}`,
      }}
    >
      <span>Drive save failed</span>
      {!compact && failed && (
        <span style={{ fontWeight: 400, color: t.textSecondary, whiteSpace: 'normal' }}>· {failed}</span>
      )}
      <span aria-hidden="true" style={{ color: t.textFaint }}>·</span>
      <button
        type="button"
        onClick={(e) => void retry(e)}
        disabled={busy}
        data-testid="drive-chip-retry"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          font: 'inherit',
          fontWeight: 700,
          color: JELLY_TOKENS.warning,
          cursor: busy ? 'default' : 'pointer',
          textDecoration: 'underline',
        }}
      >
        {busy ? 'Saving…' : 'Retry'}
      </button>
      {err && (
        <span role="alert" style={{ fontWeight: 400, color: JELLY_TOKENS.error, whiteSpace: 'normal' }}>
          {err}
        </span>
      )}
    </span>
  );
}
