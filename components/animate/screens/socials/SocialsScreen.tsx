'use client';

/**
 * Socials — channel cards, post performance, upcoming queue, recent posts.
 * Animate design language (tokens + VCard), not hq.css.
 */

import * as React from 'react';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { ConnectionsPanel, type SocialAccountsResp } from '../live/ConnectionsPanel';
import { ChannelStatCards, type ChannelCard, type StatsWindow } from './ChannelStatCards';
import { PostPerformance, type PostPerfRow } from './PostPerformance';
import { UpcomingQueue } from './UpcomingQueue';
import { RecentPosts } from './RecentPosts';
import { DripScheduler } from './DripScheduler';
import { HousePostsDashboard } from './HousePostsDashboard';
import { EmptyState, ErrorBar } from '../live/AutopilotScreen';
import { useTier } from '../../tier-context';

export function SocialsScreen(): React.ReactElement {
  const { t } = useTheme();
  const { tier } = useTier();
  const isOwner = tier === 'owner';
  const [windowDays, setWindowDays] = React.useState<StatsWindow>(28);
  const [channels, setChannels] = React.useState<ChannelCard[]>([]);
  const [posts, setPosts] = React.useState<PostPerfRow[]>([]);
  const [collecting, setCollecting] = React.useState(false);
  const [statsErr, setStatsErr] = React.useState<string | null>(null);
  const [accounts, setAccounts] = React.useState<SocialAccountsResp | null>(null);
  const [schedulerOpen, setSchedulerOpen] = React.useState(false);

  const loadStats = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/vater/socials/stats?window=${windowDays}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        channels?: ChannelCard[];
        posts?: PostPerfRow[];
        collecting?: boolean;
      };
      setChannels(data.channels ?? []);
      setPosts(data.posts ?? []);
      setCollecting(Boolean(data.collecting));
      setStatsErr(null);
    } catch (err) {
      setStatsErr(err instanceof Error ? err.message : 'stats failed');
    }
  }, [windowDays]);

  React.useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const connected = (accounts?.accounts ?? []).filter((a) => a.status !== 'failed');
  const noAccounts = accounts !== null && connected.length === 0;
  const waitingOnStats = !noAccounts && accounts !== null && channels.length === 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: t.text, margin: 0 }}>Socials</h2>
          <p style={{ fontSize: 14, color: t.textSecondary, margin: '4px 0 0' }}>
            Followers, views, and the queue — nothing posts until you confirm.
          </p>
        </div>
        <VBtn
          icon="upload"
          onClick={() => setSchedulerOpen(true)}
          disabled={noAccounts}
        >
          Schedule videos
        </VBtn>
      </div>

      {isOwner ? <HousePostsDashboard /> : null}

      <ConnectionsPanel
        onAccounts={(data) => setAccounts(data)}
      />

      {noAccounts ? (
        <EmptyState
          message={
            isOwner
              ? 'House channels are above. Connect a Zernio account here for per-tab cards and the drip queue.'
              : 'Connect a channel above to start — tap Connect on a platform tile.'
          }
        />
      ) : (
        <>
          {statsErr && <ErrorBar message={statsErr} />}
          {waitingOnStats || collecting ? (
            <EmptyState message="Collecting stats — check back soon." />
          ) : (
            <ChannelStatCards
              channels={channels}
              windowDays={windowDays}
              onWindow={setWindowDays}
            />
          )}
          <PostPerformance posts={posts} />
          <UpcomingQueue onChanged={() => void loadStats()} />
          <RecentPosts />
        </>
      )}

      <DripScheduler
        open={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        onScheduled={() => {
          setSchedulerOpen(false);
          void loadStats();
        }}
      />
    </div>
  );
}
