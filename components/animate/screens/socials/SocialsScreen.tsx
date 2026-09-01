'use client';

/**
 * Socials — THIS studio tab only.
 *
 * House HQ ads / view-counter totals live on the main dashboard (owner).
 * This screen is Ruthann when Ruthann is selected, Estate when Estate is
 * selected. Library thumbs render even when Zernio is disconnected.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { useTier } from '../../tier-context';
import { VBtn } from '../../primitives';
import { ConnectionsPanel, type SocialAccountsResp } from '../live/ConnectionsPanel';
import { ChannelStatCards, type ChannelCard, type StatsWindow } from './ChannelStatCards';
import { PostPerformance, type PostPerfRow } from './PostPerformance';
import { UpcomingQueue } from './UpcomingQueue';
import { RecentPosts } from './RecentPosts';
import { DripScheduler } from './DripScheduler';
import { StudioVideoThumb } from './StudioVideoThumb';
import { EmptyState, ErrorBar } from '../live/AutopilotScreen';
import type { StudioHighlight, StudioVideo } from '@/lib/vater/socials/studio-library';

interface StudioPayload {
  workspace?: { userId: string; name: string; isPrimary: boolean };
  videos?: StudioVideo[];
  channels?: ChannelCard[];
  posts?: PostPerfRow[];
  collecting?: boolean;
  connectedAccounts?: number;
  queueCount?: number;
  encouragement?: string;
  highlight?: StudioHighlight | null;
}

export function SocialsScreen(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, setSelectedProjectId } = useRoute();
  const { workspace } = useTier();
  const [windowDays, setWindowDays] = React.useState<StatsWindow>(28);
  const [payload, setPayload] = React.useState<StudioPayload | null>(null);
  const [statsErr, setStatsErr] = React.useState<string | null>(null);
  const [accounts, setAccounts] = React.useState<SocialAccountsResp | null>(null);
  const [schedulerOpen, setSchedulerOpen] = React.useState(false);

  const loadStudio = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/vater/socials/studio?window=${windowDays}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPayload((await res.json()) as StudioPayload);
      setStatsErr(null);
    } catch (err) {
      setStatsErr(err instanceof Error ? err.message : 'studio socials failed');
    }
  }, [windowDays]);

  React.useEffect(() => {
    void loadStudio();
  }, [loadStudio]);

  const studioName = payload?.workspace?.name || workspace?.name || 'This studio';
  const videos = payload?.videos ?? [];
  const channels = payload?.channels ?? [];
  const posts = payload?.posts ?? [];
  const highlight = payload?.highlight ?? null;
  const connected = (accounts?.accounts ?? []).filter((a) => a.status !== 'failed');
  const hasZernio = connected.length > 0;
  const winningId = (() => {
    if (highlight?.kind === 'views') {
      const best = Math.max(...videos.map((v) => v.views ?? 0));
      return videos.find((v) => (v.views ?? 0) === best)?.id ?? null;
    }
    return videos.find((v) => v.posted)?.id ?? videos[0]?.id ?? null;
  })();

  const openLibrary = (id: string) => {
    setSelectedProjectId(id);
    setRoute('library');
  };

  return (
    <div data-testid="studio-socials">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: JELLY_TOKENS.cyan,
              marginBottom: 6,
            }}
          >
            THIS STUDIO
          </div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: t.text,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {studioName}
          </h2>
          <p style={{ fontSize: 14, color: t.textSecondary, margin: '6px 0 0', maxWidth: 560 }}>
            {payload?.encouragement ?? `${studioName} — how this tab is doing.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {highlight ? (
            <div
              className="jc-blink"
              data-testid="studio-winning-metric"
              style={{
                padding: '8px 14px',
                borderRadius: JELLY_TOKENS.radius.pill,
                background: JELLY_TOKENS.brandGhost,
                border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                boxShadow: JELLY_TOKENS.brandGlow,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary, marginRight: 8 }}>
                {highlight.label}
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: JELLY_TOKENS.success,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {highlight.value.toLocaleString()}
              </span>
            </div>
          ) : null}
          <VBtn icon="sparkle" onClick={() => setRoute('create')}>
            Make a video
          </VBtn>
          <VBtn icon="upload" variant="ghost" onClick={() => setSchedulerOpen(true)} disabled={!hasZernio}>
            Schedule videos
          </VBtn>
        </div>
      </div>

      {statsErr ? <ErrorBar message={statsErr} /> : null}

      {videos.length === 0 ? (
        <div
          data-testid="studio-socials-empty"
          style={{
            marginBottom: 20,
            padding: '36px 22px',
            borderRadius: JELLY_TOKENS.radius.xl,
            background: JELLY_TOKENS.gradTicket,
            border: `1px solid ${JELLY_TOKENS.brandOutline}`,
            boxShadow: JELLY_TOKENS.brandGlow,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>
            {studioName} is waiting
          </div>
          <p style={{ fontSize: 15, color: t.textSecondary, margin: '10px auto 0', maxWidth: 440, lineHeight: 1.55 }}>
            This tab is empty on purpose — make a video and Socials lights up with thumbs and
            performance. House totals live on the dashboard.
          </p>
          <div style={{ marginTop: 18 }}>
            <VBtn icon="sparkle" onClick={() => setRoute('create')}>
              Make a video for {studioName}
            </VBtn>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
              {studioName}&apos;s videos
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary }}>
              {videos.length} in this studio
              {(payload?.queueCount ?? 0) > 0 ? ` · ${payload?.queueCount} in the drip` : ''}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
              gap: 10,
            }}
          >
            {videos.map((video) => (
              <StudioVideoThumb
                key={video.id}
                video={video}
                winning={video.id === winningId && highlight?.kind === 'views'}
                dense
                onClick={() => openLibrary(video.id)}
              />
            ))}
          </div>
          {!hasZernio ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: t.textSecondary,
                padding: '10px 12px',
                borderRadius: JELLY_TOKENS.radius.md,
                background: JELLY_TOKENS.cyanGhost,
                border: `1px solid ${t.border}`,
              }}
            >
              Views on a tile come from this studio&apos;s library (posted / drip) and, when we can
              match a clip, that video&apos;s own numbers. Connect accounts below for per-tab Zernio
              cards — Socials stays full either way.
            </div>
          ) : null}
        </div>
      )}

      <ConnectionsPanel onAccounts={(data) => setAccounts(data)} />

      {hasZernio ? (
        <>
          {payload?.collecting && channels.length === 0 ? (
            <EmptyState message="Collecting this studio's Zernio stats — check back soon." />
          ) : (
            <ChannelStatCards
              channels={channels}
              windowDays={windowDays}
              onWindow={setWindowDays}
            />
          )}
          <PostPerformance posts={posts} />
          <UpcomingQueue onChanged={() => void loadStudio()} />
          <RecentPosts />
        </>
      ) : videos.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <UpcomingQueue onChanged={() => void loadStudio()} />
        </div>
      ) : null}

      <DripScheduler
        open={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        onScheduled={() => {
          setSchedulerOpen(false);
          void loadStudio();
        }}
      />
    </div>
  );
}
