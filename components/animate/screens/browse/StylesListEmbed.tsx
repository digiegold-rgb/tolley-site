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
  const { setRoute } = useRoute();
  const [styles, setStyles] = React.useState<AnyStyle[]>([]);
  const [userId, setUserId] = React.useState<string>('');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

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

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: t.textSecondary }}>
          Loading styles…
        </div>
      )}

      {error && <RetryError message={`Could not load styles — ${error}`} onRetry={load} />}

      {!loading && !error && <StylesGallery styles={styles} userId={userId} />}
    </div>
  );
}
