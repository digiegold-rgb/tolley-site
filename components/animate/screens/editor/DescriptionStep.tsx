'use client';

/* DescriptionStep — Step 7.
 *
 * The simplest of the seven by design. Title input + Generate button.
 * Wires POST /api/vater/youtube/[id]/social-metadata?platform=youtube to
 * generate SEO-aware copy via Gemini 2.5 Flash (existing route).
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, VInput, SectionHeader } from '../../primitives';
import type { EditorStepProps } from './ProjectShell';

export function DescriptionStep({ projectId, project, refresh }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [title, setTitle] = React.useState(project?.sourceTitle ?? '');
  const [busy, setBusy] = React.useState(false);
  const [generated, setGenerated] = React.useState<{ description: string; tags: string[]; hashtags: string[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { if (project?.sourceTitle) setTitle(project.sourceTitle); }, [project?.sourceTitle]);

  const generate = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/social-metadata?platform=youtube`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGenerated({
        description: data.description ?? '',
        tags: data.tags ?? [],
        hashtags: data.hashtags ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="description"
        title="Description Generator"
        description={`Generate SEO-optimized YouTube descriptions with relevant keywords and hashtags. ${SECTION_PRICES.description}.`}
        actionLabel={busy ? 'Generating…' : 'Generate'}
        onAction={generate}
      />

      <VCard variant="flat">
        <VInput value={title} onChange={setTitle} placeholder="Enter your video title or generate with AI..." maxLength={100}
          helper={`${title.length} / 100 characters`} />
      </VCard>

      {error && (
        <VCard variant="flat" style={{ borderColor: JELLY_TOKENS.error }}>
          <div style={{ color: JELLY_TOKENS.error, fontSize: 13 }}>{error}</div>
        </VCard>
      )}

      {generated && (
        <VCard variant="flat">
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>Description</div>
          <textarea readOnly value={generated.description}
            style={{
              width: '100%', minHeight: 200, padding: 12, fontFamily: JELLY_TOKENS.font, fontSize: 14,
              background: t.cardAlt, color: t.text, border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.sm, resize: 'vertical', boxSizing: 'border-box',
            }} />
          {generated.tags.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 12, marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {generated.tags.map((tag, i) => (
                  <span key={i} style={{
                    padding: '4px 10px', borderRadius: JELLY_TOKENS.radius.full,
                    background: JELLY_TOKENS.brandGhost, color: JELLY_TOKENS.brand,
                    fontSize: 12, fontWeight: 500,
                  }}>{tag}</span>
                ))}
              </div>
            </>
          )}
          {generated.hashtags.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 12, marginBottom: 6 }}>Hashtags</div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>{generated.hashtags.join(' ')}</div>
            </>
          )}
        </VCard>
      )}
    </div>
  );
}
