'use client';

/* NicheFinderScreen — the Creator Models browser.
 *
 * Promotes CREATOR_MODELS (previously buried inside
 * youtube-creator-model-picker.tsx) to a first-class screen so users can read
 * each model's title formulas / content pillars before starting a project.
 *
 * The old "Channel Discovery" tab was removed: it had no backend and only
 * ever rendered a "connecting soon" card, so the tab strip advertised a
 * feature that did not exist.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard, VInput, SectionHeader } from '../../primitives';
import { CREATOR_MODELS } from '@/lib/vater/creator-models';

export function NicheFinderScreen(): React.ReactElement {
  const { t } = useTheme();
  const { requestNewVideo } = useRoute();
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!query.trim()) return CREATOR_MODELS;
    const q = query.toLowerCase();
    return CREATOR_MODELS.filter((m) => {
      const haystack = [
        m.name,
        m.tagline,
        m.description,
        ...(m.contentPillars ?? []),
        ...((m.titleFormulas ?? []).map((f) => `${f.name} ${f.pattern}`)),
      ];
      return haystack.some((s) => typeof s === 'string' && s.toLowerCase().includes(q));
    });
  }, [query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="niche"
        title="Creator Models"
        description="The channel archetypes that shape Jelly scripts — title formulas, content pillars, and pacing for each."
      />

      <>
          <VInput value={query} onChange={setQuery} placeholder="Filter by name, pillar, or title formula…" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map((m) => (
              <VCard key={m.id} variant="flat">
                <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{m.name}</div>
                {m.tagline && (
                  <div style={{ fontSize: 12, color: JELLY_TOKENS.brand, fontWeight: 500, marginTop: 2 }}>{m.tagline}</div>
                )}
                {m.description && (
                  <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8 }}>{m.description}</div>
                )}
                {m.contentPillars && m.contentPillars.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Content Pillars</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {m.contentPillars.map((p, i) => (
                        <span key={i} style={{
                          padding: '3px 8px', borderRadius: JELLY_TOKENS.radius.full,
                          background: JELLY_TOKENS.brandGhost, color: JELLY_TOKENS.brand,
                          fontSize: 11, fontWeight: 500,
                        }}>{p}</span>
                      ))}
                    </div>
                  </>
                )}
                {m.titleFormulas && m.titleFormulas.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title Formulas</div>
                    <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                      {m.titleFormulas.slice(0, 3).map((f) => (
                        <li key={f.id} style={{ fontSize: 12, color: t.textSecondary, marginBottom: 2 }}>{f.pattern}</li>
                      ))}
                    </ul>
                  </>
                )}
                <div style={{ marginTop: 12 }}>
                  <VBtn variant="outlined" size="sm" onClick={requestNewVideo}>Start a video with this model →</VBtn>
                </div>
              </VCard>
            ))}
          </div>
        {filtered.length === 0 && (
          <VCard variant="flat">
            <div style={{ fontSize: 14, color: t.textSecondary }}>
              No creator model matches &ldquo;{query}&rdquo;. Clear the filter to see all
              {' '}{CREATOR_MODELS.length}.
            </div>
          </VCard>
        )}
      </>
    </div>
  );
}
