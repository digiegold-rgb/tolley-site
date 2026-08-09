'use client';

/* Lesson detail — script request/review/approve + segment render rail.
 *
 * The Approve & Render button is THE render gate for the course lane:
 * nothing spends until a human clicks it. While the lesson is in flight
 * this panel polls the script or chain endpoint every 5s and pushes fresh
 * lesson rows up to CourseScreen.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { RetryError, VBtn, VCard } from '../../primitives';

export interface CourseChapterDoc {
  idx: number;
  title: string;
  text: string;
  wordCount?: number;
  summaryLine?: string;
  qaIssues?: string[];
}

export interface CourseLessonRow {
  id: string;
  order: number;
  title: string;
  description: string;
  status: string;
  scriptDocJson: { chapters?: CourseChapterDoc[] } | null;
  scriptApprovedAt: string | null;
  segmentsJson: Array<{
    idx: number;
    projectId: string;
    jobId?: string | null;
    status: string;
    videoUrl?: string | null;
    durationS?: number | null;
    phase?: string | null;
    progress?: number | null;
  }> | null;
  currentSegment: number | null;
  finalVideoUrl: string | null;
  durationS: number | null;
  costJson: unknown;
  errorMessage: string | null;
}

const CHAPTER_TARGET = 770;
const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;
const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

const POLLING_STATUSES = ['script_requested', 'rendering', 'concat'];

export function LessonDetailPanel({
  lesson,
  onBack,
  onLessonChange,
}: {
  lesson: CourseLessonRow;
  onBack: () => void;
  onLessonChange: (l: CourseLessonRow) => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [jobPhase, setJobPhase] = React.useState<string | null>(null);
  const [chapters, setChapters] = React.useState<CourseChapterDoc[]>(
    () => lesson.scriptDocJson?.chapters ?? [],
  );
  const dirtyRef = React.useRef(false);

  // Refresh local chapter state when the server produces a script and the
  // human hasn't started editing.
  React.useEffect(() => {
    if (!dirtyRef.current && lesson.scriptDocJson?.chapters?.length) {
      setChapters(lesson.scriptDocJson.chapters);
    }
  }, [lesson.scriptDocJson]);

  // 5s poll while in flight (script generation or render chain).
  React.useEffect(() => {
    if (!POLLING_STATUSES.includes(lesson.status)) return;
    const url =
      lesson.status === 'script_requested'
        ? `/api/vater/course/lessons/${lesson.id}/script`
        : `/api/vater/course/lessons/${lesson.id}/poll`;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (stop) return;
        if (data.lesson) onLessonChange(data.lesson as CourseLessonRow);
        if (Array.isArray(data.warnings)) setWarnings(data.warnings);
        setJobPhase(data.job?.phase ?? null);
        setError(null);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : 'network error');
      }
    };
    void tick();
    const iv = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [lesson.id, lesson.status, onLessonChange]);

  const post = React.useCallback(
    async (path: string, body?: unknown) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/vater/course/lessons/${lesson.id}/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (data.lesson) onLessonChange(data.lesson as CourseLessonRow);
        if (Array.isArray(data.warnings)) setWarnings(data.warnings);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'network error');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [lesson.id, onLessonChange],
  );

  const cost = (lesson.costJson as { totalUsd?: number } | null)?.totalUsd ?? null;
  const segments = lesson.segmentsJson ?? [];
  const canEditScript = ['script_ready', 'failed'].includes(lesson.status) && chapters.length > 0;
  const showRequestScript =
    ['planned', 'failed'].includes(lesson.status) && !lesson.segmentsJson;
  const totalWords = chapters.reduce((a, c) => a + countWords(c.text), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <VBtn variant="ghost" size="sm" onClick={onBack}>
          ← All lessons
        </VBtn>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
            Lesson {lesson.order}: {lesson.title}
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
            {lesson.description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: t.textSecondary }}>
        <span>
          Status: <b style={{ color: t.text }}>{lesson.status}</b>
          {jobPhase ? ` (${jobPhase})` : ''}
        </span>
        <span>
          All-in cost: <b style={{ color: t.text }}>{cost !== null ? fmtUsd(cost) : '—'}</b>
        </span>
        {lesson.durationS ? (
          <span>
            Duration:{' '}
            <b style={{ color: t.text }}>
              {Math.floor(lesson.durationS / 60)}:{String(Math.round(lesson.durationS % 60)).padStart(2, '0')}
            </b>
          </span>
        ) : null}
        {chapters.length > 0 && (
          <span>
            Script: <b style={{ color: t.text }}>{totalWords} words ≈ {Math.round(totalWords / 185)} min</b>
          </span>
        )}
      </div>

      {error && <RetryError message={error} onRetry={() => setError(null)} />}
      {lesson.errorMessage && lesson.status === 'failed' && (
        <RetryError
          message={lesson.errorMessage}
          onRetry={
            lesson.segmentsJson
              ? () => void post('poll', { action: 'resume' })
              : undefined
          }
        />
      )}
      {warnings.length > 0 && (
        <VCard variant="flat" style={{ padding: '10px 14px', fontSize: 12, color: '#b58900' }}>
          {warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </VCard>
      )}

      {showRequestScript && (
        <VCard style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 14, color: t.textSecondary, marginBottom: 16 }}>
            No script yet. Generation runs on the DGX (local LLM, ~$0) and writes six ~
            {CHAPTER_TARGET}-word chapters. Nothing renders until you approve them.
          </div>
          <VBtn onClick={() => void post('script')} disabled={busy} icon="sparkle">
            {busy ? 'Requesting…' : 'Request Script'}
          </VBtn>
        </VCard>
      )}

      {lesson.status === 'script_requested' && (
        <VCard style={{ textAlign: 'center', padding: 32, fontSize: 13, color: t.textSecondary }}>
          Writing the script{jobPhase ? ` — ${jobPhase.replace(/_/g, ' ')}` : ''}… this takes a few
          minutes per chapter. The page keeps polling.
        </VCard>
      )}

      {canEditScript && (
        <>
          {chapters.map((ch, i) => {
            const wc = countWords(ch.text);
            const off = wc < CHAPTER_TARGET * 0.85 || wc > CHAPTER_TARGET * 1.18;
            return (
              <VCard key={ch.idx} variant="flat" style={{ padding: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                    Chapter {ch.idx}: {ch.title}
                  </div>
                  <div style={{ fontSize: 12, color: off ? '#b58900' : t.textSecondary }}>
                    {wc} words {off ? `(target ~${CHAPTER_TARGET})` : ''}
                  </div>
                </div>
                <textarea
                  value={ch.text}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    const next = [...chapters];
                    next[i] = { ...ch, text: e.target.value };
                    setChapters(next);
                  }}
                  rows={10}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: JELLY_TOKENS.font,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: t.text,
                    background: t.card,
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    padding: 12,
                    resize: 'vertical',
                  }}
                />
                {ch.qaIssues && ch.qaIssues.length > 0 && (
                  <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6 }}>
                    QA notes: {ch.qaIssues.join(' · ')}
                  </div>
                )}
              </VCard>
            );
          })}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <VBtn
              onClick={() =>
                void post('approve', {
                  chapters: chapters.map((c) => ({ idx: c.idx, title: c.title, text: c.text })),
                })
              }
              disabled={busy}
              icon="sparkle"
            >
              {busy ? 'Starting…' : 'Approve & Render'}
            </VBtn>
            <VBtn
              variant="outlined"
              onClick={() => {
                dirtyRef.current = false;
                void post('script', { force: true });
              }}
              disabled={busy}
            >
              Regenerate script
            </VBtn>
            <span style={{ fontSize: 12, color: t.textSecondary }}>
              Renders six segments sequentially, then stitches the master. Est. $15–25 all-in.
            </span>
          </div>
        </>
      )}

      {segments.length > 0 && (
        <VCard variant="flat" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>
            Segments
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {segments.map((s) => {
              const color =
                s.status === 'ready'
                  ? '#1a7f37'
                  : s.status === 'failed'
                    ? (JELLY_TOKENS.error as string)
                    : s.status === 'rendering'
                      ? (JELLY_TOKENS.brand as string)
                      : '#8b8b94';
              return (
                <div
                  key={s.idx}
                  style={{
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    padding: '8px 12px',
                    minWidth: 120,
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, color }}>
                    Segment {s.idx}{' '}
                    {s.status === 'rendering' && typeof s.progress === 'number'
                      ? `· ${s.progress}%`
                      : ''}
                  </div>
                  <div style={{ color: t.textSecondary, marginTop: 2 }}>
                    {s.status === 'rendering' && s.phase ? s.phase.replace(/_/g, ' ') : s.status}
                    {s.durationS ? ` · ${Math.round(s.durationS)}s` : ''}
                  </div>
                </div>
              );
            })}
          </div>
          {['rendering', 'concat'].includes(lesson.status) && (
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 10 }}>
              {lesson.status === 'concat'
                ? 'All segments rendered — stitching the lesson master…'
                : 'Rendering runs one segment at a time; keep this tab open (or come back and it resumes on the next poll).'}
            </div>
          )}
          {lesson.status !== 'ready' && (
            <div style={{ marginTop: 10 }}>
              <VBtn
                variant="outlined"
                size="sm"
                onClick={() => void post('poll', { action: 'resume' })}
                disabled={busy}
              >
                Resume chain
              </VBtn>
            </div>
          )}
        </VCard>
      )}

      {lesson.status === 'ready' && lesson.finalVideoUrl && (
        <VCard style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>
            Lesson master
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            controls
            src={lesson.finalVideoUrl}
            style={{ width: '100%', borderRadius: JELLY_TOKENS.radius.md, background: '#000' }}
          />
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 8 }}>
            {cost !== null ? `${fmtUsd(cost)} all-in · ` : ''}
            {lesson.finalVideoUrl.startsWith('https://') ? 'Hosted on Blob CDN' : 'DGX proxy'}
          </div>
        </VCard>
      )}
    </div>
  );
}
