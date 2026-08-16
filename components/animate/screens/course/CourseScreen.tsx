'use client';

/* Course Studio — production pipeline for the financial-literacy course.
 *
 * 25 lessons, each produced as: request script (DGX chaptered generator) →
 * human edit + Approve & Render (the structural gate) → 6 sequential segment
 * renders → concat master. This screen is the curriculum list + per-lesson
 * detail; all state lives on CourseLesson rows, polled every 5s while a
 * lesson is in flight.
 *
 * Inline styles only (animate style contract). Costs are always shown
 * all-in per lesson — never make anyone ask.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { RetryError, VBtn, VCard } from '../../primitives';
import { LessonDetailPanel, type CourseLessonRow, type CourseChapterDoc } from './LessonDetailPanel';

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  status: string;
}

/* Status hues on the cinema palette: not-started is faint, waiting-on-a-human
 * is warning, in-flight is violet, live/finished is success, dead is error. */
export const LESSON_STATUS_META: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planned', color: JELLY_TOKENS.dark.textFaint as string },
  script_requested: { label: 'Writing script…', color: JELLY_TOKENS.cyan as string },
  script_ready: { label: 'Awaiting approval', color: JELLY_TOKENS.warning as string },
  approved: { label: 'Approved', color: JELLY_TOKENS.brand as string },
  rendering: { label: 'Rendering', color: JELLY_TOKENS.brand as string },
  concat: { label: 'Stitching', color: JELLY_TOKENS.brand as string },
  ready: { label: 'Ready', color: JELLY_TOKENS.success as string },
  failed: { label: 'Failed', color: JELLY_TOKENS.error as string },
};

const MODULES: Array<{ name: string; from: number; to: number }> = [
  { name: 'Module 1 — Foundations', from: 1, to: 5 },
  { name: 'Module 2 — Debt', from: 6, to: 10 },
  { name: 'Module 3 — Stability', from: 11, to: 14 },
  { name: 'Module 4 — Investing', from: 15, to: 20 },
  { name: 'Module 5 — Wealth & Life', from: 21, to: 25 },
];

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

interface ClipRow {
  url: string;
  name: string;
  sceneIdx: number;
  variant: number;
  current: boolean;
  sizeBytes: number;
  sourceProject: string;
}

/* Reusable b-roll takes from render experiments (kling/wan alternates etc.),
 * served off the Blob CDN. Collapsed by default — 50+ videos should not eat
 * bandwidth until Trey opens the drawer. */
function ClipLibrary(): React.ReactElement | null {
  const { t } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [clips, setClips] = React.useState<ClipRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || clips !== null) return;
    void (async () => {
      try {
        const res = await fetch('/api/vater/course/clips');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setClips(Array.isArray(data.clips) ? data.clips : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'network error');
      }
    })();
  }, [open, clips]);

  return (
    <div>
      <VCard
        variant="flat"
        onClick={() => setOpen((o) => !o)}
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Clip Library</div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
            Animated host takes from render experiments — reusable as course b-roll.
            {clips ? ` ${clips.length} clips.` : ''}
          </div>
        </div>
        <span style={{ fontSize: 12, color: t.textSecondary }}>{open ? 'Hide' : 'Show'}</span>
      </VCard>
      {open && (
        <div style={{ marginTop: 10 }}>
          {error && <div style={{ fontSize: 12, color: JELLY_TOKENS.error as string }}>{error}</div>}
          {!clips && !error && (
            <div style={{ fontSize: 12, color: t.textSecondary, padding: 8 }}>Loading clips…</div>
          )}
          {clips && clips.length === 0 && (
            <div style={{ fontSize: 12, color: t.textSecondary, padding: 8 }}>
              No clips published yet.
            </div>
          )}
          {clips && clips.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              {clips.map((c) => (
                <VCard key={c.url} variant="flat" style={{ padding: 8 }}>
                  <video
                    src={c.url}
                    controls
                    preload="none"
                    style={{ width: '100%', borderRadius: JELLY_TOKENS.radius.md, display: 'block' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <div style={{ flex: 1, fontSize: 11, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Scene {c.sceneIdx}
                      {c.current ? ' · shipped take' : ` · alt v${c.variant}`}
                      {` · ${(c.sizeBytes / 1048576).toFixed(1)}MB`}
                    </div>
                    <a
                      href={c.url}
                      download={c.name}
                      style={{ fontSize: 11, color: JELLY_TOKENS.brand as string, textDecoration: 'none', flexShrink: 0 }}
                    >
                      Download
                    </a>
                  </div>
                </VCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function lessonCost(l: CourseLessonRow): number | null {
  const c = l.costJson as { totalUsd?: number } | null;
  return typeof c?.totalUsd === 'number' ? c.totalUsd : null;
}

export function CourseScreen(): React.ReactElement {
  const { t } = useTheme();
  const [course, setCourse] = React.useState<CourseRow | null>(null);
  const [lessons, setLessons] = React.useState<CourseLessonRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [seeding, setSeeding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const fetchCourse = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/vater/course');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCourse(data.course ?? null);
      setLessons(Array.isArray(data.lessons) ? data.lessons : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchCourse();
  }, [fetchCourse]);

  const seed = React.useCallback(async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch('/api/vater/course', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setSeeding(false);
    }
  }, [fetchCourse]);

  const updateLesson = React.useCallback((next: CourseLessonRow) => {
    setLessons((prev) => prev.map((l) => (l.id === next.id ? { ...l, ...next } : l)));
  }, []);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const readyCount = lessons.filter((l) => l.status === 'ready').length;
  const totalCost = lessons.reduce((a, l) => a + (lessonCost(l) ?? 0), 0);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: t.textSecondary }}>
        Loading course…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>Course Studio</div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
            Money, Mastered — 25-lesson financial literacy course. Request a script, review and
            approve it, and the lesson renders as six chapters stitched into one ~25-minute video.
          </div>
        </div>
        {course && (
          <div style={{ textAlign: 'right', fontSize: 13, color: t.textSecondary, flexShrink: 0 }}>
            <div>
            {readyCount}/{lessons.length} lessons ready
            </div>
            <div style={{ marginTop: 2 }}>
              All-in compute so far: <b style={{ color: t.text }}>{fmtUsd(totalCost)}</b>
            </div>
          </div>
        )}
      </div>

      {error && (
        <RetryError
          message={`Course Studio error — ${error}`}
          onRetry={() => {
            setLoading(true);
            void fetchCourse();
          }}
        />
      )}

      {!course ? (
        <VCard style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            The course hasn&apos;t been seeded yet
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 20 }}>
            Creates &ldquo;Money, Mastered&rdquo; with all 25 lesson titles and descriptions. No
            renders start — every lesson waits for a script you approve.
          </div>
          <VBtn onClick={() => void seed()} disabled={seeding} icon="sparkle">
            {seeding ? 'Seeding…' : 'Create course + 25 lessons'}
          </VBtn>
        </VCard>
      ) : selected ? (
        <LessonDetailPanel
          lesson={selected}
          onBack={() => setSelectedId(null)}
          onLessonChange={updateLesson}
        />
      ) : (
        MODULES.map((mod) => {
          const rows = lessons.filter((l) => l.order >= mod.from && l.order <= mod.to);
          if (!rows.length) return null;
          return (
            <div key={mod.name}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  margin: '4px 0 10px',
                }}
              >
                {mod.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((l) => {
                  const meta = LESSON_STATUS_META[l.status] ?? LESSON_STATUS_META.planned;
                  const cost = lessonCost(l);
                  const segs = (l.segmentsJson as Array<{ status: string }> | null) ?? [];
                  const doneSegs = segs.filter((s) => s.status === 'ready').length;
                  return (
                    <VCard
                      key={l.id}
                      variant="flat"
                      onClick={() => setSelectedId(l.id)}
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: JELLY_TOKENS.radius.md,
                          background: JELLY_TOKENS.brandGhost,
                          color: JELLY_TOKENS.brand,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {l.order}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: t.text,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {l.title}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                          {(l.status === 'rendering' || l.status === 'concat') && segs.length
                            ? `${meta.label} — segment ${Math.min(doneSegs + 1, segs.length)}/${segs.length}`
                            : meta.label}
                          {cost !== null && ` · ${fmtUsd(cost)} all-in`}
                          {l.status === 'ready' && l.durationS
                            ? ` · ${Math.round(l.durationS / 60)} min`
                            : ''}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: JELLY_TOKENS.onGradient,
                          background: meta.color,
                          borderRadius: JELLY_TOKENS.radius.pill,
                          padding: '3px 10px',
                          flexShrink: 0,
                        }}
                      >
                        {meta.label}
                      </span>
                    </VCard>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {course && !selected && <ClipLibrary />}
    </div>
  );
}

export type { CourseLessonRow, CourseChapterDoc };
