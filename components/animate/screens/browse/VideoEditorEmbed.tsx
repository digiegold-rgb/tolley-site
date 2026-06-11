'use client';

/* VideoEditorEmbed — renders the legacy timeline editor (EditorShell) inline
 * inside the v2 Shell so users never leave /vater/youtube/v2.
 *
 * Loads the project via GET /api/vater/youtube/[id] (which is the same
 * endpoint the editor's per-scene reads/writes use, so cache + auth
 * behavior matches the legacy /vater/youtube/[id]/edit page).
 *
 * Wraps EditorShell in a container that:
 *  - Shows a "← Back to Video Editor" link that returns to the gateway list
 *  - Surfaces an inline retry on fetch failure
 *  - Doesn't add a second header (Shell.Header is already on screen)
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, RetryError } from '../../primitives';
import {
  EditorShell,
  type EditorProjectInput,
} from '@/components/vater/editor/EditorShell';

interface VideoEditorEmbedProps {
  projectId: string;
}

export function VideoEditorEmbed({ projectId }: VideoEditorEmbedProps): React.ReactElement {
  const { t } = useTheme();
  const { setSelectedProjectId } = useRoute();
  const [project, setProject] = React.useState<EditorProjectInput | null>(null);
  // The full Prisma row also carries the generated script. We surface it in
  // a read-only panel below the timeline so the user can sanity-check the
  // narrative without leaving the editor. EditorShell itself doesn't need
  // the script — it never references it — so we keep this separate from
  // the EditorProjectInput shape.
  const [script, setScript] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadProject = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const p = data?.project;
      if (!p?.id) throw new Error('Project not found');
      // Normalize to EditorProjectInput shape — only the fields EditorShell reads
      const normalized: EditorProjectInput = {
        id: p.id,
        sourceTitle: p.sourceTitle ?? null,
        topic: p.topic ?? null,
        status: String(p.status ?? 'unknown'),
        audioUrl: p.audioUrl ?? null,
        audioDuration: typeof p.audioDuration === 'number' ? p.audioDuration : null,
        scenesJson: p.scenesJson ?? null,
        captionTimings: p.captionTimings ?? null,
        finalVideoUrl: p.finalVideoUrl ?? null,
      };
      setProject(normalized);
      setScript(typeof p.script === 'string' ? p.script : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadProject();
  }, [loadProject]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <VBtn
          variant="text"
          size="sm"
          icon="chevronLeft"
          onClick={() => setSelectedProjectId(null)}
        >
          Back to Video Editor list
        </VBtn>
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          {project?.sourceTitle?.trim() ||
            project?.topic?.trim() ||
            (loading ? 'Loading project…' : `Project ${projectId.slice(0, 8)}`)}
        </div>
      </div>

      {loading && !project && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            fontSize: 13,
            color: t.textSecondary,
          }}
        >
          <Icon name="videoEditor" size={36} color={JELLY_TOKENS.brand} />
          <div style={{ marginTop: 12 }}>Loading editor…</div>
        </div>
      )}

      {error && (
        <RetryError
          message={`Could not load project — ${error}`}
          onRetry={loadProject}
        />
      )}

      {project && !loading && !error && (
        <div
          style={{
            background: t.card,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: 16,
            border: `1px solid ${t.border}`,
          }}
        >
          <EditorShell project={project} />
        </div>
      )}

      {project && !loading && !error && (
        <ScriptPanel script={script} />
      )}
    </div>
  );
}

/* ─── ScriptPanel ───────────────────────────────────────────────────────
 * Read-only display of the generated script so the user can scan the
 * narrative end-to-end without bouncing into the legacy /edit page.
 * Also gives a quick "Copy" affordance for spot-pasting into Discord
 * or a doc when reviewing voiceover quality.
 */
function ScriptPanel({ script }: { script: string | null }): React.ReactElement {
  const { t } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const trimmed = (script ?? '').trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  const handleCopy = async () => {
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — silent UX-only failure is fine here.
    }
  };

  return (
    <div
      style={{
        background: t.card,
        borderRadius: JELLY_TOKENS.radius.md,
        padding: 16,
        border: `1px solid ${t.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="description" size={16} color={JELLY_TOKENS.brand} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Generated Script
          </span>
          {wordCount > 0 && (
            <span style={{ fontSize: 11, color: t.textSecondary }}>
              • {wordCount.toLocaleString()} words
            </span>
          )}
        </div>
        {trimmed && (
          <VBtn size="sm" variant="text" icon="copy" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </VBtn>
        )}
      </div>
      {trimmed ? (
        <div
          style={{
            maxHeight: 420,
            overflowY: 'auto',
            padding: 12,
            background: t.cardAlt,
            borderRadius: JELLY_TOKENS.radius.sm,
            fontSize: 13,
            lineHeight: 1.6,
            color: t.text,
            whiteSpace: 'pre-wrap',
            fontFamily: JELLY_TOKENS.font,
          }}
        >
          {trimmed}
        </div>
      ) : (
        <div
          style={{
            padding: 24,
            fontSize: 13,
            color: t.textSecondary,
            textAlign: 'center',
            background: t.cardAlt,
            borderRadius: JELLY_TOKENS.radius.sm,
          }}
        >
          No script generated yet for this project.
        </div>
      )}
    </div>
  );
}
