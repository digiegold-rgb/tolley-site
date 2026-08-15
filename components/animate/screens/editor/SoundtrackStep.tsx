'use client';

/* SoundtrackStep — Step 5.
 *
 * 3-stage flow per the prototype: Select Audio Source → Create Audio Segments
 * → Edit & Generate. Wraps the existing YouTubeMusicPicker for the
 * background-music selection. The "auto-split with AI" path posts to
 * /api/vater/youtube/[id]/scene (segment-aware) once the backend exposes a
 * segmentation endpoint; today we stub the auto-split + provide a manual UI.
 *
 * Music catalog comes from /api/vater/music-catalog (CC-BY-4.0 Kevin MacLeod).
 * The SFX sub-tab lists the real /api/vater/sfx-catalog library (it used to
 * say "coming soon"). The tab hides itself entirely when the catalog is
 * unreachable or empty, so there is never a dead tab to click.
 *
 * No audio preview: the DGX exposes catalog metadata only — there is no
 * per-clip file URL to hand an <audio> element. Add one upstream and the
 * preview becomes a two-line change here.
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, VCard, SectionHeader } from '../../primitives';
import { YouTubeMusicPicker } from '@/components/vater/youtube-music-picker';
import type { EditorStepProps } from './ProjectShell';

interface SfxRow {
  id: string;
  name: string;
  filename: string;
  tags?: string[];
  duration?: number;
}

export function SoundtrackStep({ projectId, project, refresh }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [stage, setStage] = React.useState<1 | 2 | 3>(1);
  const [source, setSource] = React.useState<'upload' | 'generated'>('generated');
  const [splitMode, setSplitMode] = React.useState<'auto' | 'manual' | null>(null);
  const [musicId, setMusicId] = React.useState<string | null>(project?.backgroundMusicId ?? null);
  const [volume, setVolume] = React.useState<number>(project?.musicVolume ?? 0.18);
  const [tab, setTab] = React.useState<'music' | 'sfx'>('music');
  const [persistError, setPersistError] = React.useState<string | null>(null);
  const [sfx, setSfx] = React.useState<SfxRow[] | null>(null);

  // Load the SFX catalog once. `null` = unknown/failed → tab stays hidden.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/sfx-catalog', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as { sfx?: SfxRow[] };
        if (cancelled) return;
        setSfx(Array.isArray(data.sfx) ? data.sfx : []);
      } catch {
        /* leave null — the tab simply doesn't appear */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sfxAvailable = Array.isArray(sfx) && sfx.length > 0;

  // Never strand the user on a tab that just disappeared.
  React.useEffect(() => {
    if (tab === 'sfx' && !sfxAvailable) setTab('music');
  }, [tab, sfxAvailable]);

  // Hydrate from project — keeps the picker reflecting persisted state on
  // remount/poll-refresh.
  React.useEffect(() => {
    if (project?.backgroundMusicId !== undefined && project?.backgroundMusicId !== null) {
      setMusicId(project.backgroundMusicId);
    }
    if (typeof project?.musicVolume === 'number') {
      setVolume(project.musicVolume);
    }
  }, [project?.backgroundMusicId, project?.musicVolume]);

  const persistMusic = React.useCallback(
    async (id: string | null, vol: number) => {
      if (!projectId) return;
      setPersistError(null);
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            backgroundMusicId: id,
            musicVolume: vol,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        await refresh();
      } catch (err) {
        setPersistError(err instanceof Error ? err.message : 'Save failed');
      }
    },
    [projectId, refresh],
  );

  const Stage = ({ n, title, active, done }: { n: number; title: string; active: boolean; done: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: done ? JELLY_TOKENS.success : active ? JELLY_TOKENS.brand : t.cardAlt,
        color: done || active ? '#fff' : t.textSecondary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 600,
      }}>{done ? '✓' : n}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: active ? t.text : t.textSecondary }}>{title}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="music"
        title="Soundtrack"
        description={`Build a background-music bed for your video. ${SECTION_PRICES.soundtrack}.`}
      />

      <VCard variant="flat">
        <Stage n={1} title="Select Audio Source" active={stage === 1} done={stage > 1} />
        {stage === 1 && (
          <div style={{ display: 'flex', gap: 12 }}>
            {(['upload', 'generated'] as const).map(src => (
              <VBtn
                key={src}
                variant={source === src ? 'primary' : 'outlined'}
                onClick={() => setSource(src)}
              >
                {src === 'upload' ? 'Upload Audio/Video' : 'Use Generated Voiceover'}
              </VBtn>
            ))}
            <VBtn onClick={() => setStage(2)} disabled={!source}>Continue →</VBtn>
          </div>
        )}
      </VCard>

      <VCard variant="flat">
        <Stage n={2} title="Create Audio Segments" active={stage === 2} done={stage > 2} />
        {stage === 2 && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <VBtn
              variant={splitMode === 'auto' ? 'primary' : 'outlined'}
              icon="sparkle"
              onClick={() => setSplitMode('auto')}
            >Auto-Split with AI</VBtn>
            <VBtn
              variant={splitMode === 'manual' ? 'primary' : 'outlined'}
              icon="scissors"
              onClick={() => setSplitMode('manual')}
            >Split Manually</VBtn>
            <VBtn onClick={() => setStage(3)} disabled={!splitMode}>Continue →</VBtn>
          </div>
        )}
      </VCard>

      <VCard variant="flat">
        <Stage n={3} title="Edit & Generate Soundtrack" active={stage === 3} done={false} />
        {stage === 3 && (
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(sfxAvailable ? (['music', 'sfx'] as const) : (['music'] as const)).map(x => (
                <div key={x} onClick={() => setTab(x)}
                  style={{
                    padding: '8px 16px', borderRadius: JELLY_TOKENS.radius.md, cursor: 'pointer',
                    background: tab === x ? JELLY_TOKENS.brandGhost : 'transparent',
                    color: tab === x ? JELLY_TOKENS.brand : t.textSecondary,
                    fontSize: 14, fontWeight: tab === x ? 600 : 500,
                  }}>{x === 'music' ? 'Background Music' : 'SFX Catalog'}</div>
              ))}
            </div>
            {tab === 'music' && (
              <>
                <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
                  CC-BY-4.0 Kevin MacLeod — optional
                </div>
                <YouTubeMusicPicker
                  value={musicId}
                  volume={volume}
                  onChange={(id, v) => {
                    setMusicId(id);
                    setVolume(v);
                    void persistMusic(id, v);
                  }}
                />
                {persistError && (
                  <div
                    style={{
                      marginTop: 8,
                      color: JELLY_TOKENS.error,
                      fontSize: 13,
                    }}
                  >
                    {persistError}
                  </div>
                )}
              </>
            )}
            {tab === 'sfx' && sfxAvailable && (
              <div
                style={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  overflowX: 'auto',
                  border: `1px solid ${t.border}`,
                  borderRadius: JELLY_TOKENS.radius.md,
                }}
              >
                {sfx!.map((clip) => (
                  <div
                    key={clip.id || clip.filename}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 14px',
                      borderBottom: `1px solid ${t.border}`,
                      fontSize: 13,
                      color: t.text,
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {clip.name || clip.filename}
                      {clip.tags && clip.tags.length > 0 && (
                        <span style={{ color: t.textSecondary }}>
                          {' '}
                          — {clip.tags.slice(0, 3).join(', ')}
                        </span>
                      )}
                    </span>
                    <span style={{ color: t.textSecondary, whiteSpace: 'nowrap' }}>
                      {typeof clip.duration === 'number'
                        ? `${clip.duration.toFixed(1)}s`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </VCard>
    </div>
  );
}
