'use client';

/**
 * StylePickerModal — opens from Dashboard's "Create Video" CTA.
 *
 * Replaces the old `setRoute('editor')` hop (which dropped users into a
 * project-less Editor). New flow:
 *   1. Modal lists existing YouTube styles + a "Create Style" tile.
 *   2. Click an existing style → POST /api/vater/youtube/new-from-style
 *      → returns { project }. We hand the projectId back via onProjectCreated
 *      so the parent can route into the Editor with the project loaded.
 *   3. Click "Create Style" → opens StyleWizardModal (modal-in-modal). On
 *      successful save, the wizard hands back the new style and we treat
 *      it the same as clicking a style card (auto-select + create project).
 *
 * No silent catches — every failure surfaces via alert() + console.error.
 * Inline styles only; theming via JELLY_TOKENS / useTheme.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { StyleWizardModal, type CreatedStyle } from './StyleWizardModal';
import { devError } from '../../log';
import { TINT_BG } from '../tint';
import { getStylePreset } from '@/lib/vater/style-presets';
import { ON_GRADIENT_PLATE } from '../tint';
import { VBtn } from '../../primitives';
import { EnginePicker, type ConciergeEngine } from '../../engine/EnginePicker';
import { quickEstimateUsd } from '@/lib/vater/billing/estimate';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockContext,
  type BillingBlockReason,
} from '../editor/BillingBlock';

interface StyleSummary {
  id: string;
  name: string;
  emoji: string | null;
  voice: string | null;
  isSystem: boolean;
  /** Drives the card's sample image via STYLE_PRESETS[].sampleImageUrl. */
  artStylePresetId?: string | null;
  referenceTranscripts: unknown;
  characters?: Array<{ id: string; imageUrl: string | null; name: string }>;
  _count?: { characters: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

function refCount(s: StyleSummary): number {
  return Array.isArray(s.referenceTranscripts) ? s.referenceTranscripts.length : 0;
}

const WORDS_PER_MINUTE = 150;
const MAX_BATCH_SCRIPTS = 10;

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

interface BatchTicket {
  projectId: string;
  code: string;
  words: number;
  estMinutes: number;
  estimateUsd: number;
  title: string;
}

export function StylePickerModal({
  open,
  onClose,
  onProjectCreated,
}: Props): React.ReactElement | null {
  const { t } = useTheme();
  const [styles, setStyles] = React.useState<StyleSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [creatingFromId, setCreatingFromId] = React.useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  // Own-script mode — paste a script and skip principle-extraction +
  // script-generation. Mirrors V1's youtube-topic-form scriptOverride flow,
  // routed through /api/vater/topic with mode="topic" + scriptOverride.
  const [useOwnScript, setUseOwnScript] = React.useState(false);
  // One textarea per script. Jelly Auto takes exactly one; Fable 5 takes a
  // batch (≤10) → POST /api/vater/concierge/submit, one ticket per script.
  const [scripts, setScripts] = React.useState<string[]>(['']);
  const [engine, setEngine] = React.useState<ConciergeEngine>('auto');
  const [submittingOwn, setSubmittingOwn] = React.useState(false);
  const [ownScriptError, setOwnScriptError] = React.useState<string | null>(null);
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [billingCtx, setBillingCtx] = React.useState<BillingBlockContext | undefined>(undefined);
  // After a Fable 5 batch lands: the tickets, shown in place of the picker.
  const [queued, setQueued] = React.useState<BatchTicket[] | null>(null);
  const scriptWordCounts = React.useMemo(() => scripts.map(countWords), [scripts]);
  const totalWords = React.useMemo(
    () => scriptWordCounts.reduce((a, b) => a + b, 0),
    [scriptWordCounts],
  );
  const scriptWordCount = scriptWordCounts[0] ?? 0;
  const multi = scripts.length > 1;
  const autoDisabledReason = multi
    ? 'Jelly Auto renders one script at a time — Fable 5 takes the whole batch, or remove the extra scripts.'
    : null;

  // Fresh confirmation state every time the modal opens.
  React.useEffect(() => {
    if (open) setQueued(null);
  }, [open]);

  // Load styles whenever modal opens.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch('/api/vater/youtube/styles', {
          cache: 'no-store',
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { styles?: StyleSummary[] };
        if (cancelled) return;
        setStyles(Array.isArray(data.styles) ? data.styles : []);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load styles';
        devError('[StylePickerModal] load styles failed:', err);
        setLoadError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Esc closes (only when no inner work is in flight).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !creatingFromId &&
        !wizardOpen &&
        !submittingOwn
      )
        onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, creatingFromId, wizardOpen, submittingOwn, onClose]);

  if (!open) return null;

  const createProjectFromStyle = async (styleId: string) => {
    if (creatingFromId || submittingOwn) return;

    // Own-script branch: route through /api/vater/topic with scriptOverride
    // so the worker uses the pasted text verbatim. Voice clone is taken from
    // the style record — block submit if the style has no voice set.
    if (useOwnScript) {
      const trimmedAll = scripts.map((x) => x.trim());
      const emptyIdx = trimmedAll.findIndex((x) => !x);
      if (emptyIdx !== -1) {
        setOwnScriptError(
          trimmedAll.length === 1
            ? 'Paste a script before picking a style.'
            : `Script ${emptyIdx + 1} is empty — paste it or remove it.`,
        );
        return;
      }
      const style = styles.find((s) => s.id === styleId);

      // ── Fable 5 Concierge: one POST for the whole batch. The server
      // validates every script, authorises the style, pre-checks the
      // cumulative credit and queues N tickets. Nothing is rendered here. ──
      if (engine === 'fable5') {
        setSubmittingOwn(true);
        setOwnScriptError(null);
        setCreatingFromId(styleId);
        try {
          const res = await fetch('/api/vater/concierge/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              styleId,
              scripts: trimmedAll.map((script) => ({ script })),
            }),
          });
          await assertOk(res);
          const data = (await res.json()) as { tickets?: BatchTicket[] };
          const tickets = Array.isArray(data.tickets) ? data.tickets : [];
          if (tickets.length === 0) throw new Error('No ticket returned');
          if (tickets.length === 1) {
            // Single script → straight into the editor; the ticket card is
            // the confirmation.
            onProjectCreated(tickets[0].projectId);
          } else {
            setQueued(tickets);
          }
        } catch (err) {
          devError('[StylePickerModal] concierge batch submit failed:', err);
          if (err instanceof BillingBlockedError) {
            setBillingBlock(err.reason);
            setBillingCtx(err.context);
          } else {
            setOwnScriptError(err instanceof Error ? err.message : 'Could not send to Fable 5');
          }
        } finally {
          setSubmittingOwn(false);
          setCreatingFromId(null);
        }
        return;
      }

      // ── Jelly Auto: exactly one script through /api/vater/topic with
      // scriptOverride (unchanged). Voice clone comes from the style. ──────
      if (multi) {
        setOwnScriptError(autoDisabledReason);
        return;
      }
      const trimmed = trimmedAll[0];
      if (!style?.voice) {
        setOwnScriptError(
          `Style "${style?.name ?? 'selected'}" has no voice clone configured. Pick a style with a voice or set one up first.`,
        );
        return;
      }
      setSubmittingOwn(true);
      setOwnScriptError(null);
      setCreatingFromId(styleId);
      try {
        const res = await fetch('/api/vater/topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: trimmed.slice(0, 80),
            goal: 'User-supplied script',
            targetDuration: Math.max(
              1,
              Math.min(30, Math.round(scriptWordCount / WORDS_PER_MINUTE)),
            ),
            targetWordCount: Math.max(1, scriptWordCount),
            voiceCloneName: style.voice,
            styleId,
            scriptOverride: trimmed,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
          };
          throw new Error(data.detail || data.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { project?: { id?: string } };
        const projectId = data?.project?.id;
        if (!projectId || typeof projectId !== 'string') {
          throw new Error('No project id returned');
        }
        onProjectCreated(projectId);
      } catch (err) {
        devError('[StylePickerModal] own-script topic kickoff failed:', err);
        const msg = err instanceof Error ? err.message : 'Failed to create project';
        setOwnScriptError(msg);
      } finally {
        setSubmittingOwn(false);
        setCreatingFromId(null);
      }
      return;
    }

    setCreatingFromId(styleId);
    try {
      const res = await fetch('/api/vater/youtube/new-from-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { project?: { id?: string } };
      const projectId = data?.project?.id;
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('No project id returned');
      }
      onProjectCreated(projectId);
    } catch (err) {
      devError('[StylePickerModal] new-from-style failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      alert(`Could not create project: ${msg}`);
    } finally {
      setCreatingFromId(null);
    }
  };

  const handleWizardCreated = async (style: CreatedStyle) => {
    setWizardOpen(false);
    // Refresh the list (best-effort) and immediately create a project from
    // the new style — parity with TubeGen's "Create Style" → straight into
    // editor flow.
    setStyles((prev) => [
      {
        id: style.id,
        name: style.name,
        emoji: style.emoji ?? null,
        voice: style.voice ?? null,
        isSystem: false,
        artStylePresetId: null,
        referenceTranscripts: style.referenceTranscripts ?? [],
        _count: { characters: 0 },
      },
      ...prev,
    ]);
    await createProjectFromStyle(style.id);
  };

  const baseCardStyle: React.CSSProperties = {
    border: `1px solid ${t.border}`,
    borderRadius: JELLY_TOKENS.radius.lg,
    padding: 18,
    background: t.card,
    cursor: 'pointer',
    transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 160,
    fontFamily: JELLY_TOKENS.font,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select a style"
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
        if (e.target === e.currentTarget && !creatingFromId && !wizardOpen) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 980,
          maxHeight: '90vh',
          /* Opaque panel — `t.card` is translucent glass now. */
          background: t.panel,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.xxl,
          boxShadow: JELLY_TOKENS.shadow24,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: JELLY_TOKENS.font,
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
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
              {queued ? 'Sent to Fable 5' : useOwnScript ? 'Pick a Style for Voice' : 'Select a Style'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.textSecondary,
                marginTop: 2,
              }}
            >
              {queued
                ? `${queued.length} scripts queued — one ticket each. You'll get an email per video as it lands.`
                : useOwnScript
                  ? engine === 'fable5'
                    ? 'Picking a style sends your script(s) to Fable 5 in that style and voice.'
                    : 'Picking a style uses its voice clone for narration and starts the project with your script.'
                  : 'Pick an existing style to start, or create a new one tuned to your channel.'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!!creatingFromId || submittingOwn}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: t.textSecondary,
              cursor: creatingFromId || submittingOwn ? 'not-allowed' : 'pointer',
              padding: 4,
              opacity: creatingFromId || submittingOwn ? 0.4 : 1,
            }}
          >
            <Icon name="close" size={20} color={t.textSecondary} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
          }}
        >
          {/* Use-my-own-script toggle. ON → script-paste mode (skips DGX
              script gen, F5-TTS reads pasted text verbatim). OFF → normal
              new-from-style flow. */}
          {!queued && (
          <label
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: 12,
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${useOwnScript ? JELLY_TOKENS.brand : t.border}`,
              background: useOwnScript ? JELLY_TOKENS.brandGhost : t.cardAlt,
              cursor: submittingOwn ? 'not-allowed' : 'pointer',
              marginBottom: 16,
              opacity: submittingOwn ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={useOwnScript}
              disabled={submittingOwn}
              onChange={(e) => {
                setUseOwnScript(e.target.checked);
                setOwnScriptError(null);
              }}
              style={{
                marginTop: 3,
                accentColor: JELLY_TOKENS.brand,
                cursor: submittingOwn ? 'not-allowed' : 'pointer',
              }}
            />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: t.text }}>
                I already have a script — use mine
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: t.textSecondary,
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                Skips principle extraction + script generation. F5-TTS reads
                your text verbatim; scenes plan off it directly. Pick a style
                below for voice + visual direction — or send it to Fable 5.
              </span>
            </span>
          </label>
          )}

          {useOwnScript && !queued && (
            <div style={{ marginBottom: 16 }}>
              {scripts.map((text, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.textSecondary,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {multi ? `Script ${i + 1}` : 'Your script'}
                    {multi && (
                      <button
                        type="button"
                        onClick={() => {
                          setScripts((prev) => prev.filter((_, j) => j !== i));
                          setOwnScriptError(null);
                        }}
                        disabled={submittingOwn}
                        aria-label={`Remove script ${i + 1}`}
                        style={{
                          marginLeft: 'auto',
                          background: 'transparent',
                          border: 'none',
                          color: t.textFaint,
                          cursor: submittingOwn ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          textTransform: 'none',
                          letterSpacing: 0,
                          fontFamily: JELLY_TOKENS.font,
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setScripts((prev) => prev.map((x, j) => (j === i ? v : x)));
                      if (ownScriptError) setOwnScriptError(null);
                    }}
                    disabled={submittingOwn}
                    rows={multi ? 7 : 10}
                    placeholder={
                      multi
                        ? `Paste script ${i + 1} here.`
                        : 'Paste your script here. Picking a style below will start the project.'
                    }
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      padding: 12,
                      borderRadius: JELLY_TOKENS.radius.md,
                      border: `1px solid ${t.border}`,
                      background: t.card,
                      color: t.text,
                      fontFamily: JELLY_TOKENS.font,
                      fontSize: 13,
                      lineHeight: 1.5,
                      outline: 'none',
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: t.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    {scriptWordCounts[i]} words ≈{' '}
                    {(scriptWordCounts[i] / WORDS_PER_MINUTE).toFixed(1)} min narration
                    at {WORDS_PER_MINUTE} wpm
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {scripts.length < MAX_BATCH_SCRIPTS && (
                  <button
                    type="button"
                    data-testid="add-another-script"
                    onClick={() => {
                      setScripts((prev) => [...prev, '']);
                      // A batch is a Fable 5 thing — Auto takes one script.
                      setEngine('fable5');
                      setOwnScriptError(null);
                    }}
                    disabled={submittingOwn}
                    style={{
                      background: 'transparent',
                      border: `1px dashed ${t.borderStrong}`,
                      borderRadius: JELLY_TOKENS.radius.pill,
                      padding: '6px 12px',
                      color: t.text,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: submittingOwn ? 'not-allowed' : 'pointer',
                      fontFamily: JELLY_TOKENS.font,
                    }}
                  >
                    + Add another script
                  </button>
                )}
                {multi && (
                  <span style={{ fontSize: 11.5, color: t.textFaint }}>
                    {scripts.length} scripts · {totalWords.toLocaleString()} words ·{' '}
                    {scripts.length} Fable 5 tickets
                  </span>
                )}
              </div>

              {/* Engine — under the textareas, above the styles. */}
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.textSecondary,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  Engine
                </div>
                <EnginePicker
                  value={engine}
                  onChange={(e) => {
                    setEngine(e);
                    setOwnScriptError(null);
                  }}
                  estimateUsd={
                    totalWords > 0
                      ? multi
                        ? scriptWordCounts.reduce((a, w) => a + (w > 0 ? quickEstimateUsd(w) : 0), 0)
                        : quickEstimateUsd(scriptWordCount)
                      : null
                  }
                  disabled={submittingOwn}
                  autoDisabledReason={autoDisabledReason}
                  compact
                />
              </div>

              {ownScriptError && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${JELLY_TOKENS.error}`,
                    ...TINT_BG.error,
                    color: JELLY_TOKENS.error,
                    fontSize: 12,
                  }}
                >
                  {ownScriptError}
                </div>
              )}
            </div>
          )}

          {/* Fable 5 batch confirmation — replaces the picker once the
              tickets exist. The editor's ticket card takes over from here. */}
          {queued && (
            <div
              data-testid="concierge-batch-queued"
              style={{
                padding: 18,
                borderRadius: JELLY_TOKENS.radius.xl,
                background: JELLY_TOKENS.gradTicket,
                border: `1px solid ${JELLY_TOKENS.brandOutline}`,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
                {queued.length} scripts queued for Fable 5
              </div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Each one is directed in your style and voice, rendered in the studio and watched by a
                person before it lands in your Library. Typical turnaround is a few hours, up to ~24h in
                beta. Billed only when each video lands — same price as Auto.
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 6 }}>
                {queued.map((tk) => (
                  <li
                    key={tk.projectId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: JELLY_TOKENS.radius.md,
                      background: t.card,
                      border: `1px solid ${t.border}`,
                      fontSize: 13,
                      color: t.text,
                    }}
                  >
                    <span style={{ fontFamily: JELLY_TOKENS.fontMono, color: JELLY_TOKENS.brandLight, fontSize: 12 }}>
                      {tk.code}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tk.title}
                    </span>
                    <span style={{ fontSize: 11.5, color: t.textFaint, whiteSpace: 'nowrap' }}>
                      {tk.words.toLocaleString()} w · ~{tk.estMinutes} min · est. ${tk.estimateUsd.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onProjectCreated(tk.projectId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: t.link,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontFamily: JELLY_TOKENS.font,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                <VBtn variant="ghost" size="sm" onClick={onClose}>
                  Done
                </VBtn>
                <VBtn
                  variant="primary"
                  size="sm"
                  icon="sparkle"
                  onClick={() => onProjectCreated(queued[0].projectId)}
                >
                  Open the first one
                </VBtn>
              </div>
            </div>
          )}

          {!queued && loadError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${JELLY_TOKENS.error}`,
                ...TINT_BG.error,
                color: JELLY_TOKENS.error,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {loadError}
            </div>
          )}

          {!queued && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {/* Create Style tile */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!creatingFromId) setWizardOpen(true);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !creatingFromId) {
                  e.preventDefault();
                  setWizardOpen(true);
                }
              }}
              style={{
                ...baseCardStyle,
                background: JELLY_TOKENS.gradCreate,
                border: 'none',
                color: JELLY_TOKENS.onGradient,
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: creatingFromId ? 'not-allowed' : 'pointer',
                opacity: creatingFromId ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: ON_GRADIENT_PLATE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Icon name="plus" size={28} color={JELLY_TOKENS.onGradient} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Create Style</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Tune voice, script, visuals
              </div>
            </div>

            {/* Existing styles */}
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`sk-${i}`}
                    style={{
                      ...baseCardStyle,
                      background: t.cardAlt,
                      cursor: 'default',
                      opacity: 0.5,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: t.hover,
                      }}
                    />
                    <div
                      style={{
                        height: 14,
                        width: '60%',
                        background: t.hover,
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        height: 12,
                        width: '40%',
                        background: t.hover,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                ))
              : styles.map((s) => {
                  const refs = refCount(s);
                  const charImg = s.characters?.find(
                    (c) => c.imageUrl,
                  )?.imageUrl;
                  const isCreating = creatingFromId === s.id;
                  // The whole point of a style card is showing the style.
                  // Until now every card rendered a 40px emoji tile while the
                  // real 16:9 sample sat unused in /public/vater/styles.
                  const sampleImg = s.artStylePresetId
                    ? getStylePreset(s.artStylePresetId)?.sampleImageUrl
                    : undefined;
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => createProjectFromStyle(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          createProjectFromStyle(s.id);
                        }
                      }}
                      style={{
                        ...baseCardStyle,
                        cursor:
                          creatingFromId && !isCreating
                            ? 'not-allowed'
                            : 'pointer',
                        opacity: creatingFromId && !isCreating ? 0.5 : 1,
                        borderColor: isCreating
                          ? JELLY_TOKENS.brand
                          : t.border,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          margin: '-18px -18px 2px',
                          aspectRatio: '16 / 9',
                          overflow: 'hidden',
                          borderTopLeftRadius: JELLY_TOKENS.radius.lg,
                          borderTopRightRadius: JELLY_TOKENS.radius.lg,
                          background: JELLY_TOKENS.brandGhost,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 30,
                        }}
                      >
                        {sampleImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={sampleImg}
                            alt={`${s.name} sample frame`}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <span aria-hidden="true">{s.emoji || '🎨'}</span>
                        )}
                        {charImg && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={charImg}
                            alt=""
                            style={{
                              position: 'absolute',
                              left: 8,
                              bottom: 8,
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: `2px solid ${t.card}`,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: t.text,
                          lineHeight: 1.25,
                        }}
                      >
                        {s.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: t.textSecondary,
                        }}
                      >
                        {s.voice || 'No voice set'}
                      </div>
                      <div
                        style={{
                          marginTop: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: t.textSecondary,
                          }}
                        >
                          {refs} ref video{refs === 1 ? '' : 's'}
                        </span>
                        {s.isSystem && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: JELLY_TOKENS.brandGhost,
                              color: JELLY_TOKENS.brand,
                              letterSpacing: 0.4,
                              textTransform: 'uppercase',
                            }}
                          >
                            System
                          </span>
                        )}
                        {isCreating && (
                          <span
                            style={{
                              fontSize: 11,
                              color: JELLY_TOKENS.brand,
                            }}
                          >
                            opening…
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
          )}

          {!queued && !loading && styles.length === 0 && !loadError && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                textAlign: 'center',
                fontSize: 13,
                color: t.textSecondary,
                border: `1px dashed ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
              }}
            >
              No styles yet — click <strong>Create Style</strong> above to
              build your first.
            </div>
          )}
        </div>
      </div>

      <StyleWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleWizardCreated}
      />
      <BillingBlockModal
        reason={billingBlock}
        context={billingCtx}
        onClose={() => setBillingBlock(null)}
      />
    </div>
  );
}
