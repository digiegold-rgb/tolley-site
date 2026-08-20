'use client';

/* StyleEditEmbed — single-style editor rendered inline inside v2.
 *
 * Wraps StyleEditorSimple. Fetches the style via GET /api/vater/youtube/styles/[id].
 *
 * The wrapped editor uses next/router internally for some navigation
 * (e.g. after delete, push to /vater/youtube/styles). Those still work —
 * the Shell click interceptor captures legacy URL navigations and routes
 * back to v2.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, RetryError } from '../../primitives';
import { StyleEditorSimple } from '@/components/vater/styles/StyleEditorSimple';
import { StyleEditor } from '@/components/vater/styles/StyleEditor';

// The wrapped editor's exact Style shape includes characters + customArtStyle —
// those come back from the server alongside the style row.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any;

interface StyleEditEmbedProps {
  styleId: string;
}

export function StyleEditEmbed({ styleId }: StyleEditEmbedProps): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, setSelectedStyleId } = useRoute();
  const [style, setStyle] = React.useState<AnyStyle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  /* Simple ↔ Advanced (2026-08-20): the advanced editor (pacing, quality
   * backend, smart overlays, multi-character) used to be reachable only on
   * the legacy /vater page — in-studio, its link looped back to the simple
   * editor and read as a dead feature. */
  const [advanced, setAdvanced] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/vater/youtube/styles/${styleId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const s = data?.style ?? data;
      if (!s?.id) throw new Error('Style not found');
      setStyle(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, [styleId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <VBtn
          variant="text"
          size="sm"
          icon="chevronLeft"
          onClick={() => {
            setSelectedStyleId(null);
            setRoute('styles-list');
          }}
        >
          Back to Styles
        </VBtn>
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          {style?.name?.trim() || (loading ? 'Loading style…' : `Style ${styleId.slice(0, 8)}`)}
        </div>
        {style && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <VBtn
              size="sm"
              variant={advanced ? 'ghost' : 'outlined'}
              onClick={() => {
                setAdvanced(false);
                void load();
              }}
            >
              Simple
            </VBtn>
            <VBtn
              size="sm"
              variant={advanced ? 'outlined' : 'ghost'}
              onClick={() => {
                setAdvanced(true);
                void load();
              }}
            >
              Advanced
            </VBtn>
          </div>
        )}
      </div>

      {loading && !style && (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: t.textSecondary }}>
          Loading style…
        </div>
      )}

      {error && <RetryError message={`Could not load style — ${error}`} onRetry={load} />}

      {style && !loading && !error && (
        <div
          style={{
            background: t.card,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: 16,
            border: `1px solid ${t.border}`,
          }}
        >
          <div className="jelly-legacy">
            {advanced ? (
              /* key remounts the editor after a Simple-side save so it never
                 shows stale fields; onDeleted keeps delete in-studio. */
              <StyleEditor
                key={`adv-${style.updatedAt ?? ''}`}
                initialStyle={style}
                onDeleted={() => {
                  setSelectedStyleId(null);
                  setRoute('styles-list');
                }}
              />
            ) : (
              <StyleEditorSimple
                key={`simple-${style.updatedAt ?? ''}`}
                initialStyle={style}
                onAdvancedView={() => {
                  setAdvanced(true);
                  void load();
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
