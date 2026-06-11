'use client';

/* Styles tab — wraps the existing StylesGallery + Custom Art Styles link.
 *
 * Loads styles from /api/vater/youtube/styles. Reference status badges per
 * preset come from /api/vater/reference-status. System styles (isSystem) are
 * displayed read-only — no Edit/Delete (memory: feature-inventory.md risk
 * #16 — System styles immutability).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard, SectionHeader, RetryError } from '../../primitives';
import { StylesGallery } from '@/components/vater/styles/StylesGallery';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any;

export function Styles(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const [styles, setStyles] = React.useState<AnyStyle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string>('');

  const loadStyles = React.useCallback(async () => {
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
    void loadStyles();
  }, [loadStyles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="styles"
        title="Styles"
        description="Channel style profiles drive every part of your content workflow — script tone, voice, visuals, characters."
      />
      <div style={{ display: 'flex', gap: 12 }}>
        <VBtn variant="outlined" icon="plus" onClick={() => setRoute('custom-art-styles')}>
          Custom Art Styles
        </VBtn>
        <VBtn variant="text" onClick={() => setRoute('styles-list')}>
          Manage all styles →
        </VBtn>
      </div>
      {loading && (
        <VCard variant="flat"><div style={{ color: t.textSecondary, fontSize: 14 }}>Loading styles…</div></VCard>
      )}
      {error && <RetryError message={`Could not load styles — ${error}`} onRetry={loadStyles} />}
      {!loading && !error && (
        <StylesGallery styles={styles} userId={userId} />
      )}
    </div>
  );
}
