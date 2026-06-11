'use client';

/**
 * PromptReviewModal — review & edit the per-scene image prompts BEFORE
 * regenerating images.
 *
 * Why this exists: the autopilot pipeline drafts an `imagePrompt` for every
 * scene during the `prompting` phase, then immediately renders all stills.
 * If the model writes something off (gender drift, weird phrasing, mismatched
 * vibe), the user only finds out scene-by-scene on playback. This modal
 * surfaces all prompts at once so the user can sweep through, fix copy, and
 * re-render only the scenes they touched.
 *
 * Wiring: each row is its own POST /api/vater/youtube/[id]/scene/regen call
 * — same endpoint the SceneEditorDrawer uses. No backend changes; the route
 * already accepts an arbitrary `imagePrompt` string and merges per-scene per
 * risk #1 in feature-inventory.md.
 *
 * Errors: every fetch surfaces a real message via `errors[idx]` shown inline.
 * No silent catches — see feedback_silent_failures_leads.md.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { Icon } from '../../Icon';

export interface PromptReviewScene {
  idx: number;
  startS: number;
  endS: number;
  imagePrompt: string;
  beatText: string;
  version: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  scenes: PromptReviewScene[];
  /** Called after at least one regen completes so VisualsStep refetches. */
  onComplete: () => Promise<void> | void;
  /** When provided and non-empty, only these sceneIdxs start selected.
   *  Otherwise the modal defaults to all scenes selected. Lets the caller
   *  carry over a multi-select made in the scenes list. */
  initialSelected?: Set<number>;
}

type RowStatus = 'idle' | 'running' | 'success' | 'error';

function fmt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0:00';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PromptReviewModal({
  open,
  onClose,
  projectId,
  scenes,
  onComplete,
  initialSelected,
}: Props): React.ReactElement | null {
  const { t } = useTheme();

  // Per-scene editable prompt buffer. Seeded from the project on open and
  // each time the underlying scene set changes.
  const [prompts, setPrompts] = React.useState<Record<number, string>>({});
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [status, setStatus] = React.useState<Record<number, RowStatus>>({});
  const [errors, setErrors] = React.useState<Record<number, string>>({});
  const [batchRunning, setBatchRunning] = React.useState(false);
  const cancelledRef = React.useRef(false);

  // Reseed on open so the modal always shows the freshest server state.
  React.useEffect(() => {
    if (!open) return;
    const next: Record<number, string> = {};
    for (const sc of scenes) next[sc.idx] = sc.imagePrompt ?? '';
    setPrompts(next);
    if (initialSelected && initialSelected.size > 0) {
      // Honor caller's selection — but only keep idxs that exist in this
      // scene set, in case the project changed between selection + open.
      const valid = new Set<number>();
      for (const sc of scenes) if (initialSelected.has(sc.idx)) valid.add(sc.idx);
      setSelected(valid.size > 0 ? valid : new Set(scenes.map((s) => s.idx)));
    } else {
      setSelected(new Set(scenes.map((s) => s.idx)));
    }
    setStatus({});
    setErrors({});
    cancelledRef.current = false;
  }, [open, scenes, initialSelected]);

  // Esc to close (only when nothing is regenerating — don't strand a job).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !batchRunning) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, batchRunning, onClose]);

  if (!open) return null;

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(scenes.map((s) => s.idx)));
  const selectNone = () => setSelected(new Set());

  const editPrompt = (idx: number, value: string) => {
    setPrompts((prev) => ({ ...prev, [idx]: value }));
    // Clear any prior error/success once the user edits — fresh attempt.
    setStatus((prev) => ({ ...prev, [idx]: 'idle' }));
    setErrors((prev) => {
      if (!(idx in prev)) return prev;
      const { [idx]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const regenOne = async (idx: number): Promise<boolean> => {
    const text = (prompts[idx] ?? '').trim();
    if (!text) {
      setStatus((p) => ({ ...p, [idx]: 'error' }));
      setErrors((p) => ({ ...p, [idx]: 'Prompt is empty.' }));
      return false;
    }
    setStatus((p) => ({ ...p, [idx]: 'running' }));
    setErrors((p) => {
      const { [idx]: _drop, ...rest } = p;
      return rest;
    });
    try {
      const res = await fetch(
        `/api/vater/youtube/${projectId}/scene/regen`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneIdx: idx, imagePrompt: text }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus((p) => ({ ...p, [idx]: 'success' }));
      return true;
    } catch (err) {
      setStatus((p) => ({ ...p, [idx]: 'error' }));
      setErrors((p) => ({
        ...p,
        [idx]: err instanceof Error ? err.message : 'Regen failed',
      }));
      return false;
    }
  };

  const regenSingle = async (idx: number) => {
    if (batchRunning) return;
    setBatchRunning(true);
    try {
      const ok = await regenOne(idx);
      if (ok) await onComplete();
    } finally {
      setBatchRunning(false);
    }
  };

  // Sequential to avoid hammering DGX (each scene is 5-30s on the GPU).
  // We don't bail on row failure — the user wants to know which ones broke.
  const regenSelected = async () => {
    if (batchRunning) return;
    const ids = Array.from(selected).sort((a, b) => a - b);
    if (ids.length === 0) return;
    setBatchRunning(true);
    cancelledRef.current = false;
    let anySuccess = false;
    for (const idx of ids) {
      if (cancelledRef.current) break;
      const ok = await regenOne(idx);
      if (ok) anySuccess = true;
    }
    if (anySuccess) await onComplete();
    setBatchRunning(false);
  };

  const cancelBatch = () => {
    cancelledRef.current = true;
  };

  const sortedScenes = scenes.slice().sort((a, b) => a.idx - b.idx);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review image prompts"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !batchRunning) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: '90vh',
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: JELLY_TOKENS.radius.lg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              Review Image Prompts
            </div>
            <div
              style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}
            >
              Edit any prompt, pick which scenes to regenerate. Each row hits
              /scene/regen — same endpoint as the per-scene editor.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={batchRunning}
            style={{
              background: 'transparent',
              border: 'none',
              color: t.textSecondary,
              cursor: batchRunning ? 'not-allowed' : 'pointer',
              padding: 4,
              opacity: batchRunning ? 0.4 : 1,
            }}
            aria-label="Close"
          >
            <Icon name="close" size={20} color={t.textSecondary} />
          </button>
        </div>

        {/* Selection toolbar */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 12,
            color: t.textSecondary,
            background: t.cardAlt,
          }}
        >
          <span>
            {selected.size} of {scenes.length} selected
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={selectAll}
            disabled={batchRunning}
            style={{
              background: 'transparent',
              border: 'none',
              color: JELLY_TOKENS.brand,
              fontSize: 12,
              cursor: batchRunning ? 'not-allowed' : 'pointer',
            }}
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            disabled={batchRunning}
            style={{
              background: 'transparent',
              border: 'none',
              color: JELLY_TOKENS.brand,
              fontSize: 12,
              cursor: batchRunning ? 'not-allowed' : 'pointer',
            }}
          >
            Select None
          </button>
        </div>

        {/* Scene rows */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {sortedScenes.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                fontSize: 13,
                color: t.textSecondary,
              }}
            >
              No scenes yet. Run Generate Prompts first.
            </div>
          ) : (
            sortedScenes.map((sc) => {
              const rowStatus = status[sc.idx] ?? 'idle';
              const isSelected = selected.has(sc.idx);
              const dur = Math.max(0, sc.endS - sc.startS);
              return (
                <div
                  key={sc.idx}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: 12,
                    border: `1px solid ${
                      rowStatus === 'success'
                        ? 'rgba(34,197,94,0.5)'
                        : rowStatus === 'error'
                          ? 'rgba(220,38,38,0.5)'
                          : t.border
                    }`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: t.cardAlt,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(sc.idx)}
                    disabled={batchRunning}
                    style={{
                      marginTop: 4,
                      width: 16,
                      height: 16,
                      cursor: batchRunning ? 'not-allowed' : 'pointer',
                      accentColor: JELLY_TOKENS.brand,
                    }}
                    aria-label={`Include scene ${sc.idx + 1}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: JELLY_TOKENS.brandGhost,
                          color: JELLY_TOKENS.brand,
                        }}
                      >
                        Scene {sc.idx + 1}
                      </span>
                      <span style={{ fontSize: 11, color: t.textSecondary }}>
                        {fmt(sc.startS)}–{fmt(sc.endS)} • {dur.toFixed(1)}s
                      </span>
                      <span style={{ flex: 1 }} />
                      {rowStatus === 'running' && (
                        <span
                          style={{ fontSize: 11, color: JELLY_TOKENS.brand }}
                        >
                          regenerating…
                        </span>
                      )}
                      {rowStatus === 'success' && (
                        <span
                          style={{ fontSize: 11, color: '#22c55e' }}
                          title="Image regenerated"
                        >
                          ✓ done
                        </span>
                      )}
                      {rowStatus === 'error' && (
                        <span
                          style={{ fontSize: 11, color: JELLY_TOKENS.error }}
                        >
                          ✗ failed
                        </span>
                      )}
                    </div>
                    {sc.beatText && (
                      <div
                        style={{
                          fontSize: 11,
                          color: t.textSecondary,
                          marginBottom: 6,
                          fontStyle: 'italic',
                        }}
                      >
                        Beat: “{sc.beatText}”
                      </div>
                    )}
                    <textarea
                      value={prompts[sc.idx] ?? ''}
                      onChange={(e) => editPrompt(sc.idx, e.target.value)}
                      disabled={batchRunning && rowStatus === 'running'}
                      rows={3}
                      placeholder="Image prompt — what the model will render"
                      style={{
                        width: '100%',
                        background: t.card,
                        color: t.text,
                        border: `1px solid ${t.border}`,
                        borderRadius: JELLY_TOKENS.radius.sm,
                        padding: '8px 10px',
                        fontSize: 13,
                        fontFamily: JELLY_TOKENS.font,
                        lineHeight: 1.45,
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                    {errors[sc.idx] && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: JELLY_TOKENS.error,
                        }}
                      >
                        {errors[sc.idx]}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <VBtn
                      size="sm"
                      variant="outlined"
                      onClick={() => regenSingle(sc.idx)}
                      disabled={
                        batchRunning ||
                        !((prompts[sc.idx] ?? '').trim().length > 0)
                      }
                    >
                      Regen This
                    </VBtn>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: t.cardAlt,
          }}
        >
          <div style={{ fontSize: 11, color: t.textSecondary }}>
            Sequential regen — each scene takes 5–30s on the renderer.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {batchRunning ? (
              <VBtn size="sm" variant="ghost" onClick={cancelBatch}>
                Stop after current
              </VBtn>
            ) : (
              <VBtn size="sm" variant="ghost" onClick={onClose}>
                Close
              </VBtn>
            )}
            <VBtn
              size="sm"
              onClick={regenSelected}
              disabled={batchRunning || selected.size === 0}
            >
              {batchRunning
                ? 'Regenerating…'
                : `Regenerate Selected (${selected.size})`}
            </VBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
