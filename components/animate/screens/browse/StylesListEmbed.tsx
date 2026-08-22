'use client';

/* StylesListEmbed — full styles gallery rendered inline inside v2.
 *
 * Wraps the existing StylesGallery component (which uses internal <Link>s
 * to /vater/youtube/styles/[id]). The Shell-level click interceptor
 * captures those links and redirects to in-v2 navigation.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, RetryError, SectionHeader } from '../../primitives';
import { StylesGallery } from '@/components/vater/styles/StylesGallery';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any;

export function StylesListEmbed(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, openStyleEditor } = useRoute();
  const [styles, setStyles] = React.useState<AnyStyle[]>([]);
  const [userId, setUserId] = React.useState<string>('');
  /* Which row carries the locked house cast — see lib/vater/locked-style.ts.
     The gallery renders every style identically, so without this the style
     that IS the show looked like any other card. */
  const [lockedStyleId, setLockedStyleId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/vater/youtube/styles', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setStyles(Array.isArray(data?.styles) ? data.styles : []);
      setUserId(typeof data?.userId === 'string' ? data.userId : '');
      setLockedStyleId(
        typeof data?.lockedStyleId === 'string' ? data.lockedStyleId : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const canonStyle = React.useMemo(
    () => (lockedStyleId ? styles.find((s) => s?.id === lockedStyleId) ?? null : null),
    [styles, lockedStyleId],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <SectionHeader
          icon="styles"
          title="Styles"
          description="Reusable channel-style profiles. Voice, references, characters, art style — all in one container."
        />
        <VBtn variant="text" size="sm" onClick={() => setRoute('custom-art-styles')}>
          Custom Art Styles →
        </VBtn>
      </div>

      {!loading && !error && canonStyle && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: JELLY_TOKENS.radius.lg,
            border: `1px solid ${JELLY_TOKENS.canon}55`,
            background: 'linear-gradient(120deg, rgba(231,184,75,0.10), transparent 60%)',
            fontSize: 13,
            color: t.text,
            lineHeight: 1.6,
          }}
        >
          <strong>⭐ {canonStyle.name}</strong> is your canon style — the locked
          house cast, art style and voice every video ships with. Videos made on
          any other style use a different character.{' '}
          <button
            type="button"
            onClick={() => setRoute('characters')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: JELLY_TOKENS.canon,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            See the house cast →
          </button>
        </div>
      )}

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: t.textSecondary }}>
          Loading styles…
        </div>
      )}

      {error && <RetryError message={`Could not load styles — ${error}`} onRetry={load} />}

      {!loading && !error && (
        <div className="jelly-legacy">
          {/* onOpenStyle keeps Create/Clone & Edit INSIDE the studio — the
              gallery's own router.push would hard-navigate to the legacy
              /vater chrome (2026-08-20 walkthrough finding). */}
          <StylesGallery styles={styles} userId={userId} onOpenStyle={openStyleEditor} />
        </div>
      )}
    </div>
  );
}
