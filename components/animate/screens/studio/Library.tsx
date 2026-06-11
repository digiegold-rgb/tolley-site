'use client';

/* Library tab — wraps the existing YouTubeLibrary lightbox grid.
 *
 * Source: components/vater/youtube-library.tsx (399 lines).
 * Contract: feature-inventory.md §2.2.
 *
 * Self-loads the project list via GET /api/vater/youtube and filters to
 * status==='ready'. Owns optimistic delete + recompose-start handlers so
 * cards leave the grid immediately when the user acts on them.
 *
 * Inline styles only. The wrapped YouTubeLibrary keeps its own Tailwind
 * styling — that's intentional, we are NOT re-skinning it here.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { RetryError } from '../../primitives';
import { YouTubeLibrary } from '@/components/vater/youtube-library';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

export function Library(): React.ReactElement {
  const { t } = useTheme();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProjects = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/vater/youtube');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const ready = React.useMemo(
    // Show 'ready' AND 'editing' so a re-animate / re-compose in progress
    // never hides the project from Library (the underlying scenesJson + audio
    // are intact even when editedAt > completedAt). Without this filter
    // expansion, status=='editing' projects vanished after Re-Animate clicks
    // and looked deleted to users.
    () => projects.filter((p) => p?.status === 'ready' || p?.status === 'editing'),
    [projects],
  );

  const handleDelete = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/vater/youtube/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        // eslint-disable-next-line no-alert
        alert(`Delete failed: HTTP ${res.status}`);
        return;
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Delete failed: ${err instanceof Error ? err.message : 'network error'}`);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleRecomposeStart = React.useCallback((id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'editing' } : p)),
    );
  }, []);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          {ready.length} {ready.length === 1 ? 'video' : 'videos'} in library —
          play, download, share, or delete.
        </div>
        <button
          type="button"
          onClick={fetchProjects}
          style={{
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: '6px 12px',
            fontSize: 12,
            color: t.textSecondary,
            cursor: 'pointer',
            fontFamily: JELLY_TOKENS.font,
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <RetryError
            message={`Could not load projects — ${error}`}
            onRetry={() => {
              setLoading(true);
              void fetchProjects();
            }}
          />
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            fontSize: 13,
            color: t.textSecondary,
          }}
        >
          Loading library…
        </div>
      ) : (
        <YouTubeLibrary
          projects={ready}
          onDelete={handleDelete}
          onRecomposeStart={handleRecomposeStart}
        />
      )}
    </div>
  );
}
