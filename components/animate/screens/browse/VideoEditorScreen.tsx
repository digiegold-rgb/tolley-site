'use client';

/* VideoEditorScreen — gateway list view for the v2 timeline editor.
 *
 * Shows projects ready to edit. Clicking "Open Editor" no longer leaves
 * v2 — instead it sets selectedProjectId via useRoute(), and Shell
 * routes to VideoEditorEmbed which renders the legacy EditorShell
 * (timeline + Remotion preview + scene drawer) inline.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard, SectionHeader } from '../../primitives';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

export function VideoEditorScreen(): React.ReactElement {
  const { t } = useTheme();
  const { openProjectInVideoEditor } = useRoute();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
        if (r.ok && !cancelled) {
          const data = await r.json();
          setProjects(Array.isArray(data?.projects) ? data.projects.slice(0, 12) : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="videoEditor"
        title="Video Editor (Beta)"
        description="Timeline-based editing — drag clips, edit captions, swap audio, export. Pick a project below to open."
      />

      <VCard variant="hero" style={{ background: JELLY_TOKENS.gradTutorial, color: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Beta Notice</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
          The Video Editor is in beta. Save your work often. Range-based scrubbing requires the proxy routes — don&apos;t introduce middleware that strips Range headers.
        </div>
      </VCard>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 12 }}>Pick a project</div>
        {loading ? (
          <div style={{ color: t.textSecondary, fontSize: 13 }}>Loading…</div>
        ) : projects.length === 0 ? (
          <VCard variant="flat">
            <div style={{ color: t.textSecondary, fontSize: 14 }}>No projects yet. Create one from Topic, Transcribe, or RSS.</div>
          </VCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {projects.map((p: AnyProject) => (
              <VCard key={p.id} variant="flat" style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  {p.sourceTitle || p.topic || `Project ${p.id?.slice(0, 8)}`}
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
                  {p.status || '—'} · {p.audioDuration ? `${Math.round(p.audioDuration)}s` : '—'}
                </div>
                <VBtn
                  size="sm"
                  onClick={() => openProjectInVideoEditor(p.id)}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                >
                  Open Editor
                </VBtn>
              </VCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
