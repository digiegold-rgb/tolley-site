'use client';

/* AnalyticsScreen — cross-platform analytics + Cost subview.
 *
 * Cost subview promotes the inline calculator from YouTubeContextForm to a
 * first-class screen so users can see per-project + lifetime Modal GPU spend
 * (inventory NEEDS NEW TAB).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, SectionHeader } from '../../primitives';
import {
  formatCount,
  type YouTubeVideoStats,
} from '@/lib/vater/youtube-status';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

export function AnalyticsScreen(): React.ReactElement {
  const { t } = useTheme();
  const [tab, setTab] = React.useState<'overview' | 'cost'>('overview');
  const [video, setVideo] = React.useState<AnyData>(null);
  const [loading, setLoading] = React.useState(true);
  // Real per-video counters for everything this account published, read with
  // the user's own YouTube token.
  const [stats, setStats] = React.useState<Record<string, YouTubeVideoStats>>({});
  const [ytConnected, setYtConnected] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/analytics/video', { cache: 'no-store' });
        if (r.ok && !cancelled) setVideo(await r.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/youtube/stats', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as {
          connected?: boolean;
          stats?: Record<string, YouTubeVideoStats>;
        };
        if (cancelled) return;
        setYtConnected(data.connected !== false);
        setStats(data.stats ?? {});
      } catch {
        /* counters are informational — never break the screen over them */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = React.useMemo(
    () =>
      Object.values(stats).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)),
    [stats],
  );
  const totalViews = rows.reduce((sum, r) => sum + (r.views ?? 0), 0);
  const totalLikes = rows.reduce((sum, r) => sum + (r.likes ?? 0), 0);

  const Tabs = (
    <div style={{
      display: 'flex', gap: 4, padding: 4, background: t.card, borderRadius: JELLY_TOKENS.radius.pill,
      border: `1px solid ${t.border}`, alignSelf: 'flex-start',
    }}>
      {(['overview', 'cost'] as const).map(x => (
        <div key={x} onClick={() => setTab(x)}
          style={{
            padding: '8px 16px', borderRadius: JELLY_TOKENS.radius.pill, cursor: 'pointer',
            background: tab === x ? JELLY_TOKENS.brand : 'transparent',
            color: tab === x ? '#fff' : t.textSecondary,
            fontSize: 13, fontWeight: tab === x ? 600 : 500,
          }}>{x === 'overview' ? 'Overview' : 'Cost'}</div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader icon="niche" title="Analytics" description="Cross-platform reach + GPU spend." />
      {Tabs}

      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { label: 'Total Videos', val: video?.totalVideos ?? '—' },
              { label: 'Views (30d)', val: video?.views30d ?? '—' },
              { label: 'Watch Time (hrs)', val: video?.watchHours ?? '—' },
              { label: 'Subscribers', val: video?.subscribers ?? '—' },
            ].map(k => (
              <VCard key={k.label} variant="flat">
                <div style={{ fontSize: 12, color: t.textSecondary }}>{k.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: t.text, marginTop: 4 }}>{loading ? '…' : k.val}</div>
              </VCard>
            ))}
          </div>
          {/* Your published Jelly videos, straight from YouTube. */}
          <VCard variant="flat">
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>
              Your published videos
            </div>
            {ytConnected === false && (
              <div style={{ fontSize: 13, color: t.textSecondary }}>
                Connect YouTube from the publish panel to see views and likes
                here.
              </div>
            )}
            {ytConnected !== false && rows.length === 0 && (
              <div style={{ fontSize: 13, color: t.textSecondary }}>
                Nothing published yet — counters appear here after your first
                upload.
              </div>
            )}
            {rows.length > 0 && (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: 24,
                    fontSize: 13,
                    color: t.textSecondary,
                    marginBottom: 10,
                  }}
                >
                  <span>
                    Total views:{' '}
                    <strong style={{ color: t.text }}>
                      {formatCount(totalViews)}
                    </strong>
                  </span>
                  <span>
                    Total likes:{' '}
                    <strong style={{ color: t.text }}>
                      {formatCount(totalLikes)}
                    </strong>
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: t.textSecondary, textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px', fontWeight: 500 }}>Video</th>
                        <th style={{ padding: '6px 8px', fontWeight: 500 }}>Views</th>
                        <th style={{ padding: '6px 8px', fontWeight: 500 }}>Likes</th>
                        <th style={{ padding: '6px 8px', fontWeight: 500 }}>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.videoId} style={{ borderTop: `1px solid ${t.border}` }}>
                          <td style={{ padding: '6px 8px' }}>
                            <a
                              href={`https://youtu.be/${r.videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: JELLY_TOKENS.brand, textDecoration: 'none' }}
                            >
                              {r.videoId}
                            </a>
                          </td>
                          <td style={{ padding: '6px 8px', color: t.text }}>{formatCount(r.views)}</td>
                          <td style={{ padding: '6px 8px', color: t.text }}>{formatCount(r.likes)}</td>
                          <td style={{ padding: '6px 8px', color: t.text }}>{formatCount(r.comments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </VCard>

          <VCard variant="flat">
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>Top Performers</div>
            <div style={{ fontSize: 13, color: t.textSecondary }}>
              {video?.topPerformers?.length
                ? <ul>{video.topPerformers.map((v: AnyData, i: number) => <li key={i}>{v.title} — {v.views} views</li>)}</ul>
                : 'No data yet. Publish your first videos and check back.'}
            </div>
          </VCard>
        </>
      )}

      {tab === 'cost' && (
        <VCard variant="flat">
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>Cost Telemetry</div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
            Per-project + lifetime Modal GPU spend. Calibrated 2026-04-25.
          </div>
          <div style={{ padding: 16, background: t.cardAlt, borderRadius: JELLY_TOKENS.radius.sm, fontSize: 13, color: t.textSecondary }}>
            Cost ledger UI is wiring up. The calibrated numbers (FireRed $1.00 warmup + $0.005/scene; Wan2.2 $0.32/clip on L40S; Hunyuan / Veo / Kling / Luma metered)
            are exposed in <strong>Animation</strong> for now. Per-project rollup coming once Stripe section pricing is live (see pricing-model-spec.md).
          </div>
        </VCard>
      )}
    </div>
  );
}
