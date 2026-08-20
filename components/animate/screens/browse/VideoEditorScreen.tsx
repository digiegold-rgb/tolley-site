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
import { VBtn, VCard, RetryError, SectionHeader } from '../../primitives';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

export function VideoEditorScreen(): React.ReactElement {
  const { t } = useTheme();
  const { openProjectInVideoEditor, requestNewVideo } = useRoute();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
        if (!r.ok) throw new Error(`Could not load projects — HTTP ${r.status}`);
        const data = await r.json();
        if (!cancelled) {
          setProjects(Array.isArray(data?.projects) ? data.projects.slice(0, 12) : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load projects');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="videoEditor"
        title="Video Editor"
        description="Fine-tune a rendered video scene by scene — edit prompts, regenerate images, re-animate, re-compose. Pick a project below to open."
      />

      <VCard variant="hero" style={{ background: JELLY_TOKENS.gradTutorial, color: JELLY_TOKENS.onGradient }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>How it works</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
          Every rendered video is editable: open a scene to rewrite its prompt, regenerate the image, or re-animate it, then re-compose a fresh MP4 to your Library. Edits save as you go — you can always come back.
        </div>
      </VCard>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 12 }}>Pick a project</div>
        {loading ? (
          <div style={{ color: t.textSecondary, fontSize: 13 }}>Loading…</div>
        ) : error ? (
          <RetryError message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : projects.length === 0 ? (
          <VCard variant="flat">
            <div style={{ color: t.textSecondary, fontSize: 14, marginBottom: 12 }}>
              No projects yet. Render your first video and it will show up here, ready to edit.
            </div>
            <VBtn onClick={requestNewVideo}>Create your first video</VBtn>
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
