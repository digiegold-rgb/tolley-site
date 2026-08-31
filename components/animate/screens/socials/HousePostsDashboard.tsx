'use client';

/**
 * Owner-only house dashboard on /animate Socials.
 *
 * Same HQ Posts metrics (DGX, ads Day$/Life$, view counter, every video,
 * post-health) restyled with Animate tokens + VCard. Fetches
 * GET /api/vater/socials/house — never /api/hq/* (those 401 without the HQ
 * cookie). Studio / public sessions never mount this.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, VBtn } from '../../primitives';
import { SectionTitle, ErrorBar } from '../live/AutopilotScreen';
import {
  formatCost,
  formatCtr,
  formatInt,
  formatUsd,
  headerColTitle,
  headerMetric,
  type AdsSnapshot,
} from '@/lib/hq-ads';

const PAGE = 12;

const CHANNEL_LABEL: Record<string, string> = {
  yt: 'YouTube',
  fb: 'Facebook',
  ig: 'Instagram',
  pin: 'Pinterest',
  tt: 'TikTok',
  bsky: 'Bluesky',
  threads: 'Threads',
  x: 'X',
  marketplace: 'Marketplace',
  craigslist: 'Craigslist',
};

const PLATFORM_EMOJI: Record<string, string> = {
  youtube: '▶️',
  facebook: '📘',
  tiktok: '🎵',
  x: '𝕏',
  bluesky: '🦋',
  linkedin: 'in',
  pinterest: '📌',
};

type WindowKey = 'd30' | 'd90' | 'd365' | 'lifetime';

interface WindowStat {
  views: number | null;
  partial: boolean;
  since: string | null;
}

interface ViewChannel {
  key: string;
  platform: string;
  label: string;
  note: string | null;
  url: string;
  lifetimeViews: number | null;
  subscribers: number | null;
  subDelta1d: number | null;
  subDelta7d: number | null;
  subRounding: number;
  windows: Record<string, WindowStat>;
  viewsThrough: string | null;
  live: {
    h24: { views: number; videos: number };
    d7: { views: number; videos: number };
    topTitle: string | null;
    topViews: number | null;
  } | null;
}

interface VideoRow {
  id: string;
  channelKey: string;
  channelLabel: string;
  platform: string;
  title: string;
  publishedAt: string;
  views: number;
  url: string | null;
}

interface HealthRow {
  job: string;
  jobLabel: string;
  channel: string;
  account?: string;
  schedule: string;
  unit: string;
  status: 'ok' | 'failing' | 'dark' | 'never';
  lastFiredAt: string | null;
  lastError: string | null;
}

interface HousePayload {
  dgx: { line: string | null; updatedAt: string | null } | null;
  ads: AdsSnapshot | null;
  views: {
    updatedAt: string | null;
    totals: Record<string, { views: number; partial: boolean }>;
    channels: ViewChannel[];
  } | null;
  videos: {
    updatedAt: string | null;
    totalViews: number;
    videos: VideoRow[];
    channels: Array<{ key: string; label: string; platform: string; videos: number; views: number }>;
  } | null;
  posts: {
    days: number;
    health: HealthRow[];
    summary: {
      ok: number;
      failed: number;
      skipped: number;
      costCents: number;
      problems: number;
      declaredChannels: number;
    };
  } | null;
  errors?: Partial<Record<'dgx' | 'ads' | 'views' | 'videos' | 'posts', string>>;
}

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function signalColor(kind: 'good' | 'soft' | 'watch' | 'muted' | 'neutral' | 'bad'): string {
  if (kind === 'good') return JELLY_TOKENS.success;
  if (kind === 'soft' || kind === 'watch') return JELLY_TOKENS.warning;
  if (kind === 'bad') return JELLY_TOKENS.error;
  return 'inherit';
}

export function HousePostsDashboard(): React.ReactElement {
  const { t } = useTheme();
  const [data, setData] = React.useState<HousePayload | null>(null);
  const [days, setDays] = React.useState(7);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/vater/socials/house?days=${days}`, { cache: 'no-store' });
      if (res.status === 403) {
        setData(null);
        setErr(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as HousePayload);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'house stats failed');
    } finally {
      setLoading(false);
    }
  }, [days]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <VCard style={{ marginBottom: 16 }} data-testid="house-posts-dashboard">
        <SectionTitle icon="niche" title="House posts" sub="Loading HQ Posts metrics…" />
      </VCard>
    );
  }
  if (err && !data) {
    return (
      <VCard style={{ marginBottom: 16 }} data-testid="house-posts-dashboard">
        <ErrorBar message={err} />
      </VCard>
    );
  }
  if (!data) return <></>;

  const sectionErr = data.errors
    ? Object.values(data.errors).filter(Boolean).join(' · ')
    : null;

  return (
    <div data-testid="house-posts-dashboard" style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <SectionTitle
          icon="niche"
          title="House posts"
          sub="Same numbers as HQ → Posts. This login is the house — no Zernio connect required."
        />
      </div>
      {sectionErr ? <ErrorBar message={sectionErr} /> : null}
      <DgxCard line={data.dgx} />
      <AdsCard ads={data.ads} />
      <ViewsCard views={data.views} />
      <EveryVideoCard videos={data.videos} />
      <HealthCard
        posts={data.posts}
        days={days}
        onDays={setDays}
        onRefresh={() => void load()}
      />
    </div>
  );
}

function DgxCard({ line }: { line: HousePayload['dgx'] }): React.ReactElement | null {
  const { t } = useTheme();
  if (!line?.line) return null;
  const stale = line.updatedAt ? Date.now() - Date.parse(line.updatedAt) > 2 * 3600_000 : false;
  return (
    <VCard style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16 }}>🖥️</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text, flex: 1, minWidth: 180 }}>
          DGX: {line.line}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: stale ? 700 : 400,
            color: stale ? JELLY_TOKENS.error : t.textSecondary,
          }}
        >
          {stale && line.updatedAt
            ? `scan stale — ${ago(line.updatedAt)}`
            : line.updatedAt
              ? ago(line.updatedAt)
              : ''}
        </span>
      </div>
    </VCard>
  );
}

function AdsCard({ ads }: { ads: AdsSnapshot | null }): React.ReactElement | null {
  const { t } = useTheme();
  if (!ads) return null;
  const rows = ads.accounts.flatMap((account) =>
    account.campaigns.map((c) => ({ account, campaign: c })),
  );
  const stale = Date.now() - Date.parse(ads.asOf) > 26 * 3600_000;
  return (
    <VCard style={{ marginBottom: 12, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          {ads.accounts.map((account) => {
            const metric = headerMetric(account, account.preferLpv);
            return (
              <div key={account.key} style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                {account.label}
                {' · '}
                {formatUsd(account.spend)} {account.window === 'yesterday' ? 'yesterday' : 'today'}
                {' · '}
                {formatUsd(account.lifetimeSpend)} all-time
                {' · '}
                {formatInt(metric.value)} {metric.kind === 'LPV' ? 'LPV' : 'clk'}
                {' · '}
                {formatInt(account.leads)} leads
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: stale ? JELLY_TOKENS.error : t.textSecondary, fontWeight: stale ? 700 : 400 }}>
          {ads.source === 'placeholder' ? 'placeholder' : stale ? `stale — ${ago(ads.asOf)}` : ago(ads.asOf)}
        </span>
      </div>
      {rows.length > 0 && (
        <table
          style={{
            width: '100%',
            minWidth: 560,
            borderCollapse: 'collapse',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 12,
            color: t.text,
          }}
        >
          <thead>
            <tr style={{ color: t.textSecondary, textAlign: 'right' }}>
              <th style={{ textAlign: 'left', fontWeight: 600, padding: '3px 8px 3px 0' }}>Campaign</th>
              <th style={{ fontWeight: 600, padding: '3px 6px' }} title={headerColTitle('day$')}>
                Day $
              </th>
              <th style={{ fontWeight: 600, padding: '3px 6px' }} title={headerColTitle('life$')}>
                Life $
              </th>
              <th style={{ fontWeight: 600, padding: '3px 6px' }}>Imp</th>
              <th style={{ fontWeight: 600, padding: '3px 6px' }}>Clk</th>
              <th style={{ fontWeight: 600, padding: '3px 6px' }}>LPV</th>
              <th style={{ fontWeight: 600, padding: '3px 6px' }}>$/result</th>
              <th style={{ fontWeight: 600, padding: '3px 0 3px 6px' }}>CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ campaign }) => (
              <tr key={campaign.id}>
                <td style={{ textAlign: 'left', fontWeight: 600, padding: '3px 8px 3px 0', whiteSpace: 'nowrap' }}>
                  {campaign.displayName}
                </td>
                <td style={{ textAlign: 'right', padding: '3px 6px' }}>{formatUsd(campaign.spend)}</td>
                <td style={{ textAlign: 'right', padding: '3px 6px' }}>{formatUsd(campaign.lifetimeSpend)}</td>
                <td style={{ textAlign: 'right', padding: '3px 6px' }}>{formatInt(campaign.impressions)}</td>
                <td style={{ textAlign: 'right', padding: '3px 6px' }}>{formatInt(campaign.clicks)}</td>
                <td style={{ textAlign: 'right', padding: '3px 6px' }}>{formatInt(campaign.lpv)}</td>
                <td style={{ textAlign: 'right', padding: '3px 6px' }}>{formatCost(campaign.costPerResult)}</td>
                <td style={{ textAlign: 'right', padding: '3px 0 3px 6px' }}>{formatCtr(campaign.ctr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </VCard>
  );
}

function ViewsCard({ views }: { views: HousePayload['views'] }): React.ReactElement | null {
  const { t } = useTheme();
  const [win, setWin] = React.useState<WindowKey>('d30');
  if (!views) return null;
  const labels: Record<WindowKey, string> = {
    d30: '30 days',
    d90: '90 days',
    d365: '1 year',
    lifetime: 'All-time',
  };
  const total = win === 'lifetime' ? views.totals.lifetime : views.totals[win];
  const sorted = [...views.channels].sort((a, b) => {
    const av = win === 'lifetime' ? a.lifetimeViews : a.windows[win]?.views;
    const bv = win === 'lifetime' ? b.lifetimeViews : b.windows[win]?.views;
    return (bv ?? -1) - (av ?? -1);
  });

  return (
    <VCard style={{ marginBottom: 12 }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: t.textSecondary }}>
          Total views · {labels[win]}
          {total?.partial ? ' †' : ''}
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: t.text,
            lineHeight: 1.15,
            margin: '8px 0',
          }}
        >
          {(total?.views ?? 0).toLocaleString()}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(labels) as WindowKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setWin(k)}
              style={{
                padding: '5px 12px',
                borderRadius: JELLY_TOKENS.radius.pill,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: win === k ? JELLY_TOKENS.gradPrimary : 'transparent',
                color: win === k ? JELLY_TOKENS.onGradient : t.textSecondary,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              {labels[k]}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: t.textSecondary }}>
          {views.updatedAt ? `updated ${ago(views.updatedAt)} · refreshes hourly` : 'waiting for first collection…'}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        {sorted.map((c) => {
          const w = win === 'lifetime' ? { views: c.lifetimeViews, partial: c.platform === 'facebook' } : c.windows[win];
          const shown = w?.views ?? c.lifetimeViews;
          const metric =
            c.platform === 'bluesky' ? 'likes' : c.platform === 'linkedin' || c.platform === 'pinterest' ? 'impressions' : 'views';
          const delta = c.subDelta7d ?? c.subDelta1d;
          const deltaPeriod = c.subDelta7d !== null ? '7d' : '1d';
          return (
            <a
              key={c.key}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                padding: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                {PLATFORM_EMOJI[c.platform] ?? '•'} {c.label}
              </div>
              {c.note ? <div style={{ fontSize: 10, color: t.textSecondary, marginBottom: 6 }}>{c.note}</div> : null}
              <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: t.text }}>
                {shown !== null ? shown.toLocaleString() : '—'}
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, marginLeft: 6 }}>{metric}</span>
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6 }}>
                {c.subscribers !== null ? c.subscribers.toLocaleString() : '—'}{' '}
                {c.platform === 'youtube' ? 'subs' : 'followers'}
                {delta !== null ? (
                  <span
                    style={{
                      marginLeft: 8,
                      fontWeight: 700,
                      color: delta > 0 ? JELLY_TOKENS.success : delta < 0 ? JELLY_TOKENS.error : t.textSecondary,
                    }}
                  >
                    {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta).toLocaleString()} {deltaPeriod}
                  </span>
                ) : null}
              </div>
              {c.live ? (
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 8 }}>
                  live {c.live.h24.views.toLocaleString()} on {c.live.h24.videos} upload
                  {c.live.h24.videos === 1 ? '' : 's'} · 24h
                </div>
              ) : null}
            </a>
          );
        })}
      </div>
    </VCard>
  );
}

function EveryVideoCard({ videos }: { videos: HousePayload['videos'] }): React.ReactElement | null {
  const { t } = useTheme();
  const [channel, setChannel] = React.useState('all');
  const [sort, setSort] = React.useState<'recent' | 'top'>('recent');
  const [limit, setLimit] = React.useState(PAGE);
  React.useEffect(() => {
    setLimit(PAGE);
  }, [channel, sort]);
  if (!videos || videos.videos.length === 0) return null;
  const rows = (channel === 'all' ? videos.videos : videos.videos.filter((v) => v.channelKey === channel)).slice();
  rows.sort((a, b) =>
    sort === 'top' ? b.views - a.views : Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  const shownViews = rows.reduce((s, v) => s + v.views, 0);
  return (
    <VCard style={{ marginBottom: 12 }}>
      <SectionTitle
        icon="videoEditor"
        title="Every video"
        sub={`${rows.length.toLocaleString()} · ${shownViews.toLocaleString()} views${videos.updatedAt ? ` · pulled ${ago(videos.updatedAt)}` : ''}`}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
        {[{ key: 'all', label: 'All channels', views: videos.totalViews }, ...videos.channels].map((c) => {
          const active = channel === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setChannel(c.key)}
              style={{
                padding: '5px 11px',
                borderRadius: JELLY_TOKENS.radius.pill,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                background: active ? JELLY_TOKENS.gradPrimary : t.cardAlt,
                color: active ? JELLY_TOKENS.onGradient : t.textSecondary,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              {c.label} <span style={{ fontWeight: 600, opacity: 0.75 }}>{c.views.toLocaleString()}</span>
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        {(['recent', 'top'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            style={{
              padding: '5px 11px',
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${t.border}`,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              background: sort === s ? t.text : 'transparent',
              color: sort === s ? t.panel : t.textSecondary,
              fontFamily: JELLY_TOKENS.font,
            }}
          >
            {s === 'recent' ? 'Newest' : 'Most viewed'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.slice(0, limit).map((v) => {
          const body = (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                padding: '9px 12px',
              }}
            >
              <span style={{ fontSize: 12 }}>{PLATFORM_EMOJI[v.platform] ?? '•'}</span>
              <span
                style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}
                title={v.title}
              >
                {v.title}
              </span>
              <span style={{ fontSize: 11, color: t.textSecondary, whiteSpace: 'nowrap' }}>
                {v.channelLabel} · {ago(v.publishedAt)}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: t.text }}>
                {v.views.toLocaleString()}
                <span style={{ fontSize: 10, fontWeight: 600, color: t.textSecondary, marginLeft: 4 }}>views</span>
              </span>
            </div>
          );
          return v.url ? (
            <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
              {body}
            </a>
          ) : (
            <div key={v.id}>{body}</div>
          );
        })}
        {limit < rows.length ? (
          <VBtn variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            Show more ({rows.length - limit} left)
          </VBtn>
        ) : null}
      </div>
    </VCard>
  );
}

function HealthCard({
  posts,
  days,
  onDays,
  onRefresh,
}: {
  posts: HousePayload['posts'];
  days: number;
  onDays: (n: number) => void;
  onRefresh: () => void;
}): React.ReactElement | null {
  const { t } = useTheme();
  if (!posts) return null;
  const problems = posts.health.filter((h) => h.status !== 'ok');
  const healthy = posts.health.filter((h) => h.status === 'ok');
  const statusMeta: Record<HealthRow['status'], { label: string; color: string }> = {
    ok: { label: 'OK', color: JELLY_TOKENS.success },
    failing: { label: 'FAILING', color: JELLY_TOKENS.error },
    dark: { label: 'DARK', color: JELLY_TOKENS.error },
    never: { label: 'NEVER RAN', color: JELLY_TOKENS.warning },
  };
  return (
    <VCard style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: 12,
          borderRadius: JELLY_TOKENS.radius.md,
          background: problems.length ? 'rgba(240,96,122,0.12)' : 'rgba(52,201,138,0.12)',
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 20 }}>{problems.length ? '🔴' : '🟢'}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: problems.length ? JELLY_TOKENS.error : JELLY_TOKENS.success,
            }}
          >
            {problems.length
              ? `${problems.length} of ${posts.summary.declaredChannels} channels need attention`
              : `All ${posts.summary.declaredChannels} channels posting on schedule`}
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
            Last {posts.days}d — {posts.summary.ok} posted · {posts.summary.failed} failed ·{' '}
            {posts.summary.skipped} skipped · {money(posts.summary.costCents)} spent
          </div>
        </div>
        <select
          value={days}
          onChange={(e) => onDays(Number(e.target.value))}
          style={{
            padding: '5px 10px',
            border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.md,
            fontSize: 12,
            fontWeight: 600,
            background: t.panel,
            color: t.text,
            fontFamily: JELLY_TOKENS.font,
          }}
        >
          <option value={1}>Today</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
        <VBtn variant="ghost" size="sm" onClick={onRefresh}>
          Refresh
        </VBtn>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {[...problems, ...healthy].map((h) => {
          const s = statusMeta[h.status];
          return (
            <div
              key={`${h.job}-${h.channel}`}
              style={{
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>
                  {CHANNEL_LABEL[h.channel] ?? h.channel}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 11, color: t.textSecondary }}>
                {h.jobLabel} · {h.schedule}
              </div>
              {h.account ? <div style={{ fontSize: 11, color: t.textSecondary }}>@{h.account}</div> : null}
              <div
                style={{
                  fontSize: 11,
                  marginTop: 5,
                  fontWeight: 600,
                  color: h.status === 'ok' ? JELLY_TOKENS.success : signalColor('bad'),
                }}
              >
                {h.lastFiredAt ? `Last fired ${ago(h.lastFiredAt)}` : `No post ever recorded — ${h.unit}`}
              </div>
              {h.lastError ? (
                <div style={{ fontSize: 11, color: JELLY_TOKENS.error, marginTop: 3 }}>
                  {h.lastError.slice(0, 140)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </VCard>
  );
}
