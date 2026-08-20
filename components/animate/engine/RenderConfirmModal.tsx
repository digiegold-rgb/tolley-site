'use client';

/* RenderConfirmModal — the "you are in control" gate in front of every paid
 * submission (2026-08-20).
 *
 * Before a script goes anywhere — Jelly Auto render or Fable 5 Concierge —
 * this modal spells out exactly what the click will use: the character, the
 * voice, the art style, the soundtrack (or "none"), the length and the
 * estimated cost. While `blockers` is non-empty the confirm button is dead
 * and each blocker offers a jump to the step that fixes it. No silent
 * defaults, no surprise tickets.
 *
 * The manifest usually comes from GET /api/vater/youtube/[id]/preflight, but
 * the shape is plain data so pre-project surfaces (StylePickerModal) can
 * assemble one client-side from the style card.
 *
 * Portalled to <body> — fixed overlays inside <main> stack below the studio
 * header/sidebar (2026-08-19 beta finding).
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { JELLY_TOKENS } from '../tokens';
import { useTheme } from '../theme-context';
import { VBtn } from '../primitives';

export interface RenderManifestBlocker {
  code: string;
  message: string;
  step: number | null;
  engines: Array<'auto' | 'fable5'>;
}

export interface RenderManifest {
  words: number;
  estMinutes: number;
  style: { id: string; name: string } | null;
  voice: { name: string; backend: string | null; source: string } | null;
  character: { id: string; name: string; imageUrl: string | null; others: number } | null;
  artStyle: { kind: 'preset' | 'custom'; id: string; name: string; defaulted: boolean };
  soundtrack: {
    backgroundMusicId: string | null;
    musicVolume: number | null;
    sfxEnabled: boolean;
  };
  animUntilS: number | null;
  blockers: RenderManifestBlocker[];
}

export interface RenderConfirmModalProps {
  /** null = closed. */
  engine: 'auto' | 'fable5' | null;
  manifest: RenderManifest | null;
  /** Manifest still loading. */
  loading?: boolean;
  loadError?: string | null;
  estimateUsd?: number | null;
  /** Confirm POST in flight. */
  confirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Jump to an editor step to fix a blocker (closes the modal first). */
  onGoToStep?: (step: number) => void;
  /** Open the Styles screen for style/character blockers (closes the modal first). */
  onOpenStyles?: () => void;
}

function voiceLine(v: NonNullable<RenderManifest['voice']>): string {
  const via =
    v.backend === 'elevenlabs'
      ? 'via ElevenLabs (your account)'
      : v.backend === 'clone'
        ? 'your cloned voice'
        : v.backend
          ? `via ${v.backend}`
          : '';
  return via ? `${v.name} — ${via}` : v.name;
}

export function RenderConfirmModal({
  engine,
  manifest,
  loading,
  loadError,
  estimateUsd,
  confirming,
  onConfirm,
  onClose,
  onGoToStep,
  onOpenStyles,
}: RenderConfirmModalProps): React.ReactElement | null {
  const { t } = useTheme();
  if (!engine || typeof document === 'undefined') return null;

  const isF5 = engine === 'fable5';
  const blockers = (manifest?.blockers ?? []).filter((b) => b.engines.includes(engine));
  const blocked = loading || !!loadError || blockers.length > 0;
  const est = estimateUsd != null ? `$${estimateUsd.toFixed(2)}` : null;

  const row = (label: string, value: React.ReactNode) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 0',
        borderBottom: `1px solid ${t.border}`,
        fontSize: 13,
      }}
    >
      <span style={{ flex: '0 0 96px', color: t.textFaint, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ color: t.text, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{value}</span>
    </div>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isF5 ? 'Confirm before sending to Fable 5' : 'Confirm before rendering'}
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: t.panel,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.xxl,
          boxShadow: JELLY_TOKENS.shadow24,
          padding: 20,
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
          {isF5 ? 'Confirm — send to Fable 5?' : 'Confirm — generate this video?'}
        </div>
        <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: 6, lineHeight: 1.55 }}>
          {isF5
            ? 'Fable 5 hand-directs this script with the setup below. Nothing is billed until it is delivered to your Library.'
            : 'This is the render. Everything below is exactly what will be used — nothing is guessed.'}
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && (
            <div style={{ fontSize: 13, color: t.textSecondary, padding: '14px 0' }}>
              Checking your setup…
            </div>
          )}
          {loadError && (
            <div style={{ fontSize: 13, color: JELLY_TOKENS.error, padding: '14px 0' }}>
              {loadError}
            </div>
          )}
          {manifest && !loading && (
            <>
              {row(
                'Script',
                `${manifest.words.toLocaleString()} words · ~${manifest.estMinutes} min video`,
              )}
              {manifest.style && row('Style', manifest.style.name)}
              {row(
                'Character',
                manifest.character ? (
                  <>
                    {manifest.character.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={manifest.character.imageUrl}
                        alt=""
                        style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${t.borderStrong}` }}
                      />
                    )}
                    <span>
                      {manifest.character.name}
                      {manifest.character.others > 0 && (
                        <span style={{ color: t.textFaint }}>
                          {' '}+ {manifest.character.others} more
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <span style={{ color: t.textFaint }}>None — scenes render people-free</span>
                ),
              )}
              {row(
                'Voice',
                manifest.voice ? (
                  voiceLine(manifest.voice)
                ) : (
                  <span style={{ color: JELLY_TOKENS.warning }}>Not picked yet</span>
                ),
              )}
              {row(
                'Art style',
                <>
                  {manifest.artStyle.name}
                  {manifest.artStyle.kind === 'custom' && (
                    <span style={{ color: t.textFaint }}> (custom)</span>
                  )}
                </>,
              )}
              {row(
                'Soundtrack',
                manifest.soundtrack.backgroundMusicId ? (
                  `Background music on · volume ${Math.round((manifest.soundtrack.musicVolume ?? 0.18) * 100)}%`
                ) : (
                  <span style={{ color: t.textFaint }}>
                    None — narration only (add one in the Soundtrack step)
                  </span>
                ),
              )}
              {!isF5 &&
                row(
                  'Motion',
                  manifest.animUntilS
                    ? `First ${manifest.animUntilS}s animated, stills after`
                    : 'Stills only — you can animate scenes after the render',
                )}
              {row(
                'Estimated cost',
                <span style={{ fontWeight: 700 }}>
                  {est ?? '—'}
                  {isF5 && <span style={{ fontWeight: 400, color: t.textFaint }}> · billed on delivery</span>}
                </span>,
              )}
            </>
          )}
        </div>

        {blockers.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${JELLY_TOKENS.warning}`,
              background: 'rgba(255,180,60,0.08)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: JELLY_TOKENS.warning, marginBottom: 6 }}>
              Finish these before {isF5 ? 'sending' : 'generating'}:
            </div>
            {blockers.map((b) => (
              <div
                key={b.code}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, color: t.text }}
              >
                <span style={{ flex: 1, lineHeight: 1.5 }}>{b.message}</span>
                {b.step != null && onGoToStep ? (
                  <VBtn
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onClose();
                      onGoToStep(b.step as number);
                    }}
                  >
                    Fix it
                  </VBtn>
                ) : (b.code === 'no_character' || b.code === 'no_style') && onOpenStyles ? (
                  <VBtn
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onClose();
                      onOpenStyles();
                    }}
                  >
                    Open Styles
                  </VBtn>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <VBtn size="sm" variant="ghost" onClick={onClose} disabled={confirming}>
            Not yet
          </VBtn>
          <VBtn
            size="sm"
            onClick={onConfirm}
            disabled={blocked || confirming}
            style={{ background: blocked ? undefined : JELLY_TOKENS.gradPrimary }}
            data-testid="render-confirm"
          >
            {confirming
              ? isF5
                ? 'Sending…'
                : 'Starting…'
              : isF5
                ? `Send to Fable 5${est ? ` · ${est}` : ''}`
                : `Generate Video${est ? ` · ${est}` : ''}`}
          </VBtn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
