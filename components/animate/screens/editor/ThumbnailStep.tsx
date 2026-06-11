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
import { VBtn, VCard, SectionHeader } from '../../primitives';
import type { EditorStepProps } from './ProjectShell';

const COST_PER_PAIR = 175;

export function ThumbnailStep({ projectId, project, refresh }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const { openProjectInVideoEditor } = useRoute();
  const [mode, setMode] = React.useState<'auto' | 'manual'>('auto');
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const totalCost = COST_PER_PAIR * Math.ceil(count / 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="thumbnail"
        title="Thumbnail Generator"
        description={`AI-generated thumbnails based on your style. ${SECTION_PRICES.thumbnail} per generation.`}
      />

      <div style={{ display: 'flex', gap: 4, padding: 4, background: t.card, borderRadius: JELLY_TOKENS.radius.md, alignSelf: 'flex-start', border: `1px solid ${t.border}` }}>
        {(['auto', 'manual'] as const).map(m => (
          <div key={m} onClick={() => setMode(m)}
            style={{
              padding: '8px 16px', borderRadius: JELLY_TOKENS.radius.sm, cursor: 'pointer',
              background: mode === m ? JELLY_TOKENS.brand : 'transparent',
              color: mode === m ? '#fff' : t.textSecondary,
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
          <VBtn icon="sparkle" onClick={generate} disabled={busy || !projectId}>
            {busy ? 'Generating…' : 'Auto Generate'}
          </VBtn>
          {error && <div style={{ marginTop: 8, color: JELLY_TOKENS.error, fontSize: 13 }}>{error}</div>}
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
    </div>
  );
}
