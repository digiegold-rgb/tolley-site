'use client';

/* CustomArtStylesEmbed — Custom Art Styles gallery rendered inline in v2.
 *
 * Wraps CustomArtStyleGallery. Fetches via /api/vater/youtube/custom-art-styles.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, RetryError, SectionHeader } from '../../primitives';
import { CustomArtStyleGallery } from '@/components/vater/styles/CustomArtStyleGallery';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

export function CustomArtStylesEmbed(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const [items, setItems] = React.useState<AnyItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/vater/youtube/custom-art-styles', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setItems(Array.isArray(data?.customArtStyles) ? data.customArtStyles : []);
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
          icon="image"
          title="Custom Art Styles"
          description="Upload 3-5 reference images. Gemini Flash analyzes them and writes an 800-char art-style descriptor that gets injected into every scene prompt."
        />
        <VBtn variant="text" size="sm" onClick={() => setRoute('styles-list')}>
          ← Styles
        </VBtn>
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: t.textSecondary }}>
          Loading…
        </div>
      )}

      {error && <RetryError message={`Could not load — ${error}`} onRetry={load} />}

      {!loading && !error && <CustomArtStyleGallery items={items} />}
    </div>
  );
}
