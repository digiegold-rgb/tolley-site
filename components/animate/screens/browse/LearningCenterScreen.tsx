'use client';

/* LearningCenterScreen — gamified 14-module course.
 *
 * Phase 1 audit fix: completion now persists to localStorage so the
 * "Open Module →" button is no longer a silent dead click. Real
 * server-side LearningProgress (Prisma) lands in a follow-up phase.
 *
 * Storage shape: { [moduleId]: { completed: true, ts: ISOString } }
 * Key: vater:learning:v1
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, SectionHeader } from '../../primitives';

const STORAGE_KEY = 'vater:learning:v1';

interface ModuleSpec {
  id: string;
  title: string;
  desc: string;
  reward: number;
  /** When true the module is locked behind earlier ones — gates 4..14. */
  locks?: true;
}

const MODULES: ModuleSpec[] = [
  { id: 'site-nav', title: 'Site Navigation', desc: 'Get oriented. Find every tool.', reward: 50 },
  { id: 'help', title: 'Help Modules', desc: 'Support resources, security setup, usage tracking.', reward: 100 },
  { id: 'niche', title: 'Niche Finder', desc: 'Discover high-potential niches.', reward: 100 },
  { id: 'styles', title: 'Styles', desc: 'Reusable channel profiles.', reward: 100, locks: true },
  { id: 'titles', title: 'Title Generator', desc: 'Drive click-through.', reward: 100, locks: true },
  { id: 'scripts', title: 'Scriptwriter', desc: 'Turn inputs into a production-ready script.', reward: 150, locks: true },
  { id: 'voice', title: 'Voiceovers', desc: 'Match narration style to story.', reward: 100, locks: true },
  { id: 'visuals', title: 'Visuals', desc: 'Sequence visuals for retention.', reward: 150, locks: true },
  { id: 'soundtrack', title: 'Soundtrack', desc: 'Build music beds.', reward: 100, locks: true },
  { id: 'thumbnail', title: 'Thumbnail', desc: 'Clickable thumbnails.', reward: 100, locks: true },
  { id: 'description', title: 'Description', desc: 'SEO-aware metadata.', reward: 100, locks: true },
  { id: 'history', title: 'Project History', desc: 'Manage projects & limits.', reward: 100, locks: true },
  { id: 'editor', title: 'Video Editor', desc: 'Timeline editing.', reward: 200, locks: true },
  { id: 'teams', title: 'Teams', desc: 'Shared workspace, member roles.', reward: 200, locks: true },
];

type ProgressMap = Record<string, { completed: true; ts: string }>;

function readProgress(): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgress(p: ProgressMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* localStorage full or disabled — ignore */
  }
}

export function LearningCenterScreen(): React.ReactElement {
  const { t } = useTheme();
  const [progress, setProgress] = React.useState<ProgressMap>({});

  React.useEffect(() => {
    setProgress(readProgress());
  }, []);

  const completed = React.useMemo(
    () => MODULES.filter((m) => progress[m.id]?.completed).length,
    [progress],
  );
  const pct = Math.round((completed / MODULES.length) * 100);

  const isUnlocked = React.useCallback(
    (idx: number, m: ModuleSpec) => {
      // First three are always unlocked. Modules with locks: true gate on the
      // previous module being completed.
      if (!m.locks) return true;
      const prev = MODULES[idx - 1];
      return prev ? Boolean(progress[prev.id]?.completed) : true;
    },
    [progress],
  );

  const toggle = React.useCallback((id: string) => {
    setProgress((prev) => {
      const next = { ...prev };
      if (next[id]?.completed) {
        delete next[id];
      } else {
        next[id] = { completed: true, ts: new Date().toISOString() };
      }
      writeProgress(next);
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="learning"
        title="Learning Center"
        description="Master every tool in your workflow. Earn credits as you complete modules."
      />

      <VCard variant="hero" style={{ background: JELLY_TOKENS.gradTutorial, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Complete modules to earn credits</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Progress saves to this browser. Cross-device sync ships later.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {completed} / {MODULES.length} Completed
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{pct}%</div>
          </div>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 12 }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: '#fff',
              borderRadius: 3,
              transition: 'width .3s ease',
            }}
          />
        </div>
      </VCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {MODULES.map((m, idx) => {
          const isCompleted = Boolean(progress[m.id]?.completed);
          const unlocked = isUnlocked(idx, m);
          return (
            <VCard
              key={m.id}
              variant="flat"
              style={{
                opacity: unlocked ? 1 : 0.5,
                position: 'relative',
                cursor: unlocked ? 'pointer' : 'not-allowed',
                border: isCompleted ? `1px solid ${JELLY_TOKENS.success}` : `1px solid ${t.border}`,
              }}
              onClick={() => {
                if (unlocked) toggle(m.id);
              }}
            >
              {!unlocked && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>
                  🔒
                </div>
              )}
              {isCompleted && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    fontSize: 11,
                    color: JELLY_TOKENS.success,
                    fontWeight: 700,
                  }}
                >
                  ✓ Completed
                </div>
              )}
              {unlocked && !isCompleted && (
                <div style={{ fontSize: 11, fontWeight: 600, color: JELLY_TOKENS.brand, marginBottom: 8 }}>
                  {m.reward} unclaimed credits
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{m.title}</div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4 }}>{m.desc}</div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: !unlocked
                    ? t.textSecondary
                    : isCompleted
                      ? JELLY_TOKENS.success
                      : JELLY_TOKENS.brand,
                  fontWeight: 500,
                }}
              >
                {!unlocked
                  ? 'Complete previous modules first'
                  : isCompleted
                    ? 'Mark incomplete'
                    : 'Mark complete →'}
              </div>
            </VCard>
          );
        })}
      </div>
    </div>
  );
}
