'use client';

/* ThumbnailStep — Step 6.
 *
 * Auto Generate / Manual segmented at top.
 * Auto: Number of thumbnails dropdown (default 2), credit cost preview shown
 * BEFORE click (~175 credits per generation pair, calibrated 2026-04-25).
 * Manual: link out to /vater/youtube/[id]/edit thumbnail-tab fallback.
 *
 * Wires GET /api/vater/youtube/[id]/thumbnail for current preview; the
 * generate action calls POST /api/vater/youtube/[id]/thumbnail (no body).
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard, SectionHeader, Toast } from '../../primitives';
import {
  featureFetch,
  FeatureUnavailableError,
  COMING_ONLINE,
} from './feature-fetch';
import type { EditorStepProps } from './ProjectShell';
import { reelLabel } from './reel-label';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockReason,
} from './BillingBlock';

const COST_PER_PAIR = 175;

interface ThumbnailVariant {
  url: string;
  variant: string;
}

export function ThumbnailStep({ projectId, project, refresh }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const { openProjectInVideoEditor } = useRoute();
  const [mode, setMode] = React.useState<'auto' | 'manual'>('auto');
  // 402 from a generation route → actionable modal, not a raw error string.
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [count, setCount] = React.useState(2);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const thumbnailUrl = projectId ? `/api/vater/youtube/${projectId}/thumbnail` : null;

  const generate = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/thumbnail`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      await assertOk(res);
      await refresh();
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
      } else {
        setError(err instanceof Error ? err.message : 'failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const totalCost = COST_PER_PAIR * Math.ceil(count / 2);

  /* ── A/B variants (2026-08-16) ─────────────────────────────────────────
   * Three takes on the same title, side by side. Picking one PATCHes
   * thumbnailUrl — the same field the single-shot generator writes, so
   * nothing downstream needs to know a comparison happened. */
  const [variants, setVariants] = React.useState<ThumbnailVariant[]>([]);
  const [variantsBusy, setVariantsBusy] = React.useState(false);
  const [variantsOff, setVariantsOff] = React.useState(false);
  const [picking, setPicking] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const generateVariants = React.useCallback(async () => {
    if (!projectId) return;
    setVariantsBusy(true);
    setError(null);
    try {
      const data = await featureFetch<{ variants?: ThumbnailVariant[] }>(
        `/api/vater/youtube/${projectId}/thumbnail-variants`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ count: 3 }),
        },
      );
      const next = (data.variants ?? []).filter((v) => v && v.url);
      if (next.length === 0) {
        setError('No variants came back.');
        return;
      }
      setVariants(next);
      setToast(`${next.length} variants ready — pick the one that reads best.`);
    } catch (err) {
      if (err instanceof FeatureUnavailableError) {
        setVariantsOff(true);
        setToast(err.message || COMING_ONLINE);
      } else {
        setError(err instanceof Error ? err.message : 'Variant generation failed');
      }
    } finally {
      setVariantsBusy(false);
    }
  }, [projectId]);

  const applyVariant = React.useCallback(
    async (variant: ThumbnailVariant) => {
      if (!projectId) return;
      setPicking(variant.url);
      setError(null);
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ thumbnailUrl: variant.url }),
        });
        await assertOk(res);
        await refresh();
        setToast(`${variant.variant} is now the project thumbnail.`);
      } catch (err) {
        if (err instanceof BillingBlockedError) {
          setBillingBlock(err.reason);
        } else {
          setError(err instanceof Error ? err.message : 'Could not set thumbnail');
        }
      } finally {
        setPicking(null);
      }
    },
    [projectId, refresh],
  );

  const selectedUrl = project?.thumbnailUrl ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="thumbnail"
        eyebrow={reelLabel(5)}
        title="Thumbnail Generator"
        description={`AI-generated thumbnails based on your style. ${SECTION_PRICES.thumbnail} per generation.`}
      />

      <div style={{ display: 'flex', gap: 4, padding: 4, background: t.card, borderRadius: JELLY_TOKENS.radius.md, alignSelf: 'flex-start', border: `1px solid ${t.border}` }}>
        {(['auto', 'manual'] as const).map(m => (
          <div key={m} onClick={() => setMode(m)}
            style={{
              padding: '8px 16px', borderRadius: JELLY_TOKENS.radius.sm, cursor: 'pointer',
              background: mode === m ? JELLY_TOKENS.brand : 'transparent',
              color: mode === m ? JELLY_TOKENS.onGradient : t.textSecondary,
              fontSize: 14, fontWeight: mode === m ? 600 : 500,
            }}>{m === 'auto' ? 'Auto Generate' : 'Manual'}</div>
        ))}
      </div>

      {mode === 'auto' && (
        <VCard variant="flat">
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Auto Generate from Style</div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
            Analyzes thumbnails from your style&apos;s reference YouTube channels and generates unique thumbnail concepts based on your video title.
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>Number of thumbnails:</label>
            <select value={count} onChange={e => setCount(parseInt(e.target.value, 10))}
              style={{
                padding: '8px 12px', borderRadius: JELLY_TOKENS.radius.sm,
                border: `1px solid ${t.border}`, background: t.card, color: t.text,
                fontSize: 14, fontFamily: JELLY_TOKENS.font,
              }}>
              {[2, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ fontSize: 13, color: t.textSecondary }}>(~{totalCost} credits)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <VBtn icon="sparkle" onClick={generate} disabled={busy || !projectId}>
              {busy ? 'Generating…' : 'Auto Generate'}
            </VBtn>
            <div
              title={
                variantsOff
                  ? COMING_ONLINE
                  : 'Three takes on the same title, side by side'
              }
            >
              <VBtn
                variant="outlined"
                icon="duplicate"
                onClick={generateVariants}
                disabled={variantsBusy || variantsOff || !projectId}
                data-testid="thumbnail-variants"
              >
                {variantsBusy ? 'Generating…' : 'Generate 3 variants'}
              </VBtn>
            </div>
          </div>
          {error && <div style={{ marginTop: 8, color: JELLY_TOKENS.error, fontSize: 13 }}>{error}</div>}
        </VCard>
      )}

      {/* A/B compare grid */}
      {mode === 'auto' && variants.length > 0 && (
        <VCard variant="flat">
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>
            Compare
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
            Judge them at phone size — the one that still reads when it&apos;s
            small is the one that wins the click.
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {variants.map((v) => {
              const active = selectedUrl === v.url;
              return (
                <div
                  key={v.url}
                  style={{
                    border: `2px solid ${active ? JELLY_TOKENS.brand : t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    padding: 8,
                    background: active ? JELLY_TOKENS.brandGhost : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.url}
                    alt={v.variant}
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      objectFit: 'cover',
                      borderRadius: JELLY_TOKENS.radius.sm,
                      background: t.cardAlt,
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: t.textSecondary, flex: 1, minWidth: 0 }}>
                      {v.variant}
                    </span>
                    <VBtn
                      size="sm"
                      variant={active ? 'ghost' : 'primary'}
                      onClick={() => applyVariant(v)}
                      disabled={active || picking !== null}
                      data-testid={`thumbnail-use-${v.variant.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {active
                        ? 'In use'
                        : picking === v.url
                          ? 'Setting…'
                          : 'Use this one'}
                    </VBtn>
                  </div>
                </div>
              );
            })}
          </div>
        </VCard>
      )}

      {mode === 'manual' && (
        <VCard variant="flat">
          <div style={{ fontSize: 14, color: t.textSecondary }}>
            Manual thumbnail editing happens in the Video Editor.{' '}
            {projectId ? (
              <span
                onClick={() => openProjectInVideoEditor(projectId)}
                style={{ color: JELLY_TOKENS.brand, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Open Editor →
              </span>
            ) : 'Save project first.'}
          </div>
        </VCard>
      )}

      {thumbnailUrl && (
        <VCard variant="flat">
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>Current Thumbnail</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl} alt="thumbnail"
            style={{ width: '100%', maxWidth: 480, borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${t.border}` }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </VCard>
      )}
      <BillingBlockModal
        reason={billingBlock}
        onClose={() => setBillingBlock(null)}
      />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
