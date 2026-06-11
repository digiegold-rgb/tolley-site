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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

export function AnalyticsScreen(): React.ReactElement {
  const { t } = useTheme();
  const [tab, setTab] = React.useState<'overview' | 'cost'>('overview');
  const [video, setVideo] = React.useState<AnyData>(null);
  const [loading, setLoading] = React.useState(true);

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
