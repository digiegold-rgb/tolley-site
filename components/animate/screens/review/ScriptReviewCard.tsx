'use client';

/* ScriptReviewCard — the script editor + version history, extracted from
 * ScriptReviewScreen's ReviewPanel (2026-08-28) so the stepped Create flow
 * (step 5) and the studio Script Review screen edit the same way.
 *
 * Controlled: the parent owns `draft` (Approve sends the draft, so an unsaved
 * edit can never silently render the older text). Renders nothing that
 * spends money — buttons belong to the host.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { WORDS_PER_MINUTE, runtimeClock } from '@/lib/vater/script-limits';
import type { ScriptVersion } from './ScriptReviewScreen';

const wordsIn = (s: string): number => s.split(/\s+/).filter(Boolean).length;

export interface ScriptReviewCardProps {
  project: { id: string; scriptVersions?: ScriptVersion[] | null };
  draft: string;
  /** The text the server holds — the border tints when the draft differs. */
  saved?: string;
  onDraftChange: (next: string) => void;
  disabled?: boolean;
  /** Words + runtime line above the editor. */
  showStats?: boolean;
  minHeight?: number;
  testId?: string;
}

export function ScriptReviewCard({
  project,
  draft,
  saved,
  onDraftChange,
  disabled = false,
  showStats = true,
  minHeight = 380,
  testId = 'review-script',
}: ScriptReviewCardProps): React.ReactElement {
  const { t } = useTheme();
  const words = React.useMemo(() => wordsIn(draft), [draft]);
  const dirty = saved !== undefined && draft !== saved;
  const versions = project.scriptVersions ?? [];
  const undoRef = React.useRef<string[]>([]);
  const redoRef = React.useRef<string[]>([]);
  const [stackTick, setStackTick] = React.useState(0);
  const lastDraft = React.useRef(draft);

  React.useEffect(() => {
    if (draft === lastDraft.current) return;
    undoRef.current.push(lastDraft.current);
    if (undoRef.current.length > 40) undoRef.current.splice(0, undoRef.current.length - 40);
    redoRef.current = [];
    lastDraft.current = draft;
    setStackTick((n) => n + 1);
  }, [draft]);

  const canUndo = stackTick >= 0 && (undoRef.current.length > 0 || versions.length > 1);
  const canRedo = redoRef.current.length > 0;

  const undo = (): void => {
    if (disabled) return;
    const prev = undoRef.current.pop();
    if (prev !== undefined) {
      redoRef.current.push(draft);
      lastDraft.current = prev;
      onDraftChange(prev);
      setStackTick((n) => n + 1);
      return;
    }
    const older = versions.length >= 2 ? versions[versions.length - 2] : versions[0];
    if (older && older.script !== draft) {
      redoRef.current.push(draft);
      lastDraft.current = older.script;
      onDraftChange(older.script);
      setStackTick((n) => n + 1);
    }
  };

  const redo = (): void => {
    if (disabled) return;
    const next = redoRef.current.pop();
    if (next === undefined) return;
    undoRef.current.push(draft);
    lastDraft.current = next;
    onDraftChange(next);
    setStackTick((n) => n + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showStats && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, alignItems: 'flex-end' }}>
          <Stat label="Words" value={words.toLocaleString()} />
          <Stat label="Estimated runtime" value={`${runtimeClock(words)} at ${WORDS_PER_MINUTE} wpm`} />
          <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button
              type="button"
              data-testid="script-undo"
              disabled={disabled || !canUndo}
              onClick={undo}
              aria-label="Undo script edit"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${t.border}`,
                background: t.cardAlt,
                color: t.text,
                cursor: disabled || !canUndo ? 'not-allowed' : 'pointer',
                opacity: canUndo ? 1 : 0.45,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              Undo
            </button>
            <button
              type="button"
              data-testid="script-redo"
              disabled={disabled || !canRedo}
              onClick={redo}
              aria-label="Redo script edit"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${t.border}`,
                background: t.cardAlt,
                color: t.text,
                cursor: disabled || !canRedo ? 'not-allowed' : 'pointer',
                opacity: canRedo ? 1 : 0.45,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              Redo
            </button>
          </span>
        </div>
      )}

      {versions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: t.textSecondary }}>History</span>
          <select
            value=""
            disabled={disabled}
            data-testid="review-versions"
            onChange={(e) => {
              const idx = Number(e.target.value);
              const entry = versions[idx];
              if (entry) onDraftChange(entry.script);
            }}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: t.cardAlt,
              color: t.text,
              maxWidth: 320,
            }}
          >
            <option value="" disabled>
              Restore a previous version…
            </option>
            {versions
              .map((v, i) => ({ v, i }))
              .reverse()
              .map(({ v, i }) => (
                <option key={`${v.ts}-${i}`} value={i}>
                  v{i + 1} · {v.source} ·{' '}
                  {new Date(v.ts).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {wordsIn(v.script)}w
                </option>
              ))}
          </select>
          <span style={{ color: t.textSecondary }}>Loads into the editor — Save to keep it.</span>
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        readOnly={disabled}
        spellCheck
        data-testid={testId}
        style={{
          width: '100%',
          minHeight,
          resize: 'vertical',
          fontSize: 14,
          lineHeight: 1.75,
          fontFamily: JELLY_TOKENS.font,
          border: `1px solid ${dirty ? JELLY_TOKENS.brandOutline : t.border}`,
          borderRadius: JELLY_TOKENS.radius.md,
          background: t.card,
          color: t.text,
          outline: 'none',
          boxSizing: 'border-box',
          padding: 16,
          opacity: disabled ? 0.8 : 1,
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  const { t } = useTheme();
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: t.textFaint }}>{label}</span>
      <span style={{ fontWeight: 600, color: t.text }}>{value}</span>
    </span>
  );
}
