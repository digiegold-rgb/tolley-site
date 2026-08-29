'use client';

/* DashboardScreen — ported from vater-screens.jsx lines 4-100.
 * 4 hero cards (Create / Buy Credits / Upgrade / Tutorial),
 * 3 KPI tiles (live from /api/vater/youtube), spend timeline (live from
 * /api/vater/billing/usage), first-video checklist for zero-project users.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { useTheme, useRoute } from '../theme-context';
import { Icon, type IconName } from '../Icon';
import { VBtn, VCard, RetryError } from '../primitives';
import { GlassCard, MicroLabel } from '../cinema';
import { Footer } from '../Footer';
import { LatestUpdateBanner } from '../LatestUpdate';

interface KpiTile {
  /** Route to open when the tile is clicked — beta testers saw "2 total
   *  videos" with no way to get TO those videos from here. */
  route?: string;

  label: string;
  value: string;
  sub: string;
  icon: IconName;
}

const ACTIVE_STATUSES = new Set([
  'queued',
  'transcribing',
  'extracting_principles',
  'scripting',
  'voicing',
  'generating_scenes',
  'animating',
  'composing',
  'editing',
  'in_progress',
  // Fable 5 Concierge tickets (2026-08-19) count as in progress.
  'concierge_queued',
  'concierge_in_progress',
  'concierge_needs_info',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

/* One immutable VaterUsage ledger row — GET /api/vater/billing/usage `items`.
 * Fields mirror prisma VaterUsage; only what the timeline reads is typed. */
interface UsageItem {
  id: string;
  action: string;
  costCents: number;
  description: string | null;
  ts: string;
}

function usd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${Math.abs(cents / 100).toFixed(2)}`;
}

/* First-video checklist dismissal — same localStorage idiom as
 * BetaAccessBanner: start hidden, reveal after the client-side check. */
const CHECKLIST_DISMISS_KEY = 'jelly-first-video-checklist-dismissed';

const FIRST_VIDEO_STEPS: ReadonlyArray<{ label: string; sub: string }> = [
  { label: 'Pick a style', sub: 'Locks the look and the voice for every video on your channel' },
  { label: 'Paste or generate a script', sub: 'You approve it before anything renders' },
  { label: 'Render a stills draft', sub: 'One image per beat — your first stills are free' },
  { label: 'Add motion & publish', sub: 'Animate the scenes that earn it, then export' },
];

export function DashboardScreen(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, openHelp } = useRoute();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loadTick, setLoadTick] = React.useState(0);

  const [usageItems, setUsageItems] = React.useState<UsageItem[]>([]);
  const [usageLoading, setUsageLoading] = React.useState(true);
  const [usageError, setUsageError] = React.useState<string | null>(null);
  const [usageTick, setUsageTick] = React.useState(0);

  const [checklistVisible, setChecklistVisible] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Request failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTick]);

  // Spend timeline — the immutable VaterUsage ledger (same endpoint the
  // Settings → Usage tab reads). period=all so the 30-day window doesn't get
  // clipped by a billing period that started mid-window.
  React.useEffect(() => {
    let cancelled = false;
    setUsageLoading(true);
    setUsageError(null);
    (async () => {
      try {
        const r = await fetch('/api/vater/billing/usage?period=all&limit=200', {
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        setUsageItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!cancelled) {
          setUsageError(e instanceof Error ? e.message : 'Request failed');
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usageTick]);

  React.useEffect(() => {
    try {
      setChecklistVisible(window.localStorage.getItem(CHECKLIST_DISMISS_KEY) !== '1');
    } catch {
      // localStorage unavailable (private mode etc.) — show the checklist.
      setChecklistVisible(true);
    }
  }, []);

  const dismissChecklist = React.useCallback(() => {
    setChecklistVisible(false);
    try {
      window.localStorage.setItem(CHECKLIST_DISMISS_KEY, '1');
    } catch {
      // Best-effort persistence only — already hidden for this session.
    }
  }, []);

  const kpis: KpiTile[] = React.useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalVideos = projects.length;
    const thisMonth = projects.filter((p: AnyProject) => {
      const d = p?.createdAt ? new Date(p.createdAt) : null;
      return d && d >= monthStart;
    }).length;
    const inProgress = projects.filter((p: AnyProject) =>
      ACTIVE_STATUSES.has(String(p?.status ?? '')),
    ).length;
    const fmt = (n: number): string => (loading ? '…' : String(n));
    return [
      { label: 'Total Videos', value: fmt(totalVideos), sub: 'All time — click to browse', icon: 'videoEditor', route: 'project-history' },
      { label: 'This Month', value: fmt(thisMonth), sub: 'Created this month — click to browse', icon: 'sparkle', route: 'project-history' },
      {
        label: 'In Progress',
        value: fmt(inProgress),
        sub: inProgress === 0 ? 'No active jobs' : 'Rendering now — click for Progress',
        icon: 'history',
        route: 'progress',
      },
    ];
  }, [projects, loading]);

  // Ledger → 30 daily buckets (oldest first), this-month total, 3 latest rows.
  const spend = React.useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayKey = (d: Date): string =>
      `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const days: { key: string; date: Date; cents: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({ key: dayKey(d), date: d, cents: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    let monthCents = 0;
    let windowCents = 0;
    for (const it of usageItems) {
      const d = new Date(it.ts);
      if (Number.isNaN(d.getTime())) continue;
      if (d >= monthStart) monthCents += it.costCents;
      const bucket = byKey.get(dayKey(d));
      if (bucket) {
        bucket.cents += it.costCents;
        windowCents += it.costCents;
      }
    }
    const maxDayCents = Math.max(...days.map((d) => d.cents), 1);
    return { days, maxDayCents, monthCents, windowCents, recent: usageItems.slice(0, 3) };
  }, [usageItems]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <MicroLabel tone="cyan" style={{ marginBottom: 6 }}>
          Now showing
        </MicroLabel>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: t.text,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Dashboard
        </h2>
        <p style={{ fontSize: 14, color: t.textSecondary, margin: '4px 0 0' }}>
          Create and manage your video styles and voice clones
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <LatestUpdateBanner />
      </div>

      {/* The in-flight strip moved to the Progress tab (2026-08-28) — the
          sidebar badge/pulse is the dashboard's "something is happening". */}

      {/* Hero cards. Glass with a gradient icon tile, not three slabs of solid
          gradient — the gradient is the CTA's job now. Billing is the ticket
          variant, because every billing surface in the studio is a stub. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        <HeroCard
          eyebrow="ACT I — THE STORY"
          icon="sparkle"
          title="Create Video"
          body="Start a new video project"
          cta="Create Video"
          onCta={() => setRoute('create')}
        />
        <HeroCard
          variant="ticket"
          eyebrow="ADMIT ONE — THE BOX OFFICE"
          icon="affiliate"
          title="Billing"
          body="Prepaid credit — pay only for what you render, no subscription"
          cta="Open Billing"
          onCta={() => setRoute('pricing')}
        />
        <HeroCard
          eyebrow="THE REELS"
          icon="videoEditor"
          title="Your Library"
          body="Finished videos, ready to download or publish"
          cta="Open Library"
          onCta={() => setRoute('library')}
        />
      </div>

      {loadError && (
        <RetryError
          message={`Couldn't load your videos (${loadError}).`}
          onRetry={() => setLoadTick((n) => n + 1)}
          style={{ marginTop: 24 }}
        />
      )}

      {!loading && !loadError && projects.length === 0 && (
        <VCard style={{ marginTop: 24, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            No videos yet
          </div>
          <div
            style={{
              fontSize: 14,
              color: t.textSecondary,
              marginTop: 6,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            Start with a style — it locks the voice and the look for every video
            on your channel — then write or paste a script. Your first
            transcripts, scene generation and animation are free.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <VBtn size="sm" onClick={() => setRoute('create')}>
              Create your first video
            </VBtn>
            <VBtn variant="outlined" size="sm" onClick={openHelp}>
              How it works
            </VBtn>
          </div>
        </VCard>
      )}

      {/* First-video checklist — zero-project users only, dismissible. Plain
          checklist, not interactive gating: the editor's PillStepper does the
          real walking; this is the map. */}
      {!loading && !loadError && projects.length === 0 && checklistVisible && (
        <VCard style={{ marginTop: 16, padding: 24, position: 'relative' }}>
          <button
            onClick={dismissChecklist}
            aria-label="Dismiss checklist"
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              background: 'transparent',
              border: 'none',
              color: t.textFaint,
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '2px 6px',
              fontWeight: 700,
            }}
          >
            ×
          </button>
          <MicroLabel tone="violet" style={{ marginBottom: 8 }}>
            The shot list
          </MicroLabel>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            Your first video
          </div>
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            {FIRST_VIDEO_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                    background: JELLY_TOKENS.brandGhost,
                    color: JELLY_TOKENS.brandLight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                    {step.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <VBtn size="sm" onClick={() => setRoute('create')} style={{ marginTop: 18 }}>
            Create your first video
          </VBtn>
        </VCard>
      )}

      {/* KPI + Tutorial row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        {kpis.map((kpi, i) => (
          <VCard
            key={i}
            style={{ padding: 20, cursor: kpi.route ? 'pointer' : undefined }}
            onClick={kpi.route ? () => setRoute(kpi.route as never) : undefined}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color: t.text, marginTop: 4 }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
                  {kpi.sub}
                </div>
              </div>
              <Icon name={kpi.icon} size={24} color={JELLY_TOKENS.brand} />
            </div>
          </VCard>
        ))}
        <GlassCard
          hover
          data-testid="tutorial-card"
          padding={24}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={openHelp}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label="Getting Started with Jelly"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openHelp();
              }
            }}
            style={{ outline: 'none' }}
          >
            <MicroLabel
              tone="cyan"
              size={10.5}
              tracking="0.24em"
              style={{ position: 'absolute', top: 14, left: 20 }}
            >
              Tutorial
            </MicroLabel>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: JELLY_TOKENS.gradTutorial,
                boxShadow: JELLY_TOKENS.brandGlow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '10px auto 12px',
              }}
            >
              <Icon name="play" size={24} color={JELLY_TOKENS.onGradient} />
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                textAlign: 'center',
                color: t.text,
              }}
            >
              Getting Started with Jelly
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.textSecondary,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              Learn how every part of our platform works
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Spend timeline — the VaterUsage ledger from /api/vater/billing/usage,
          bucketed per day. Stage 0 removed the hardcoded "April 2026" +
          92,202-credit static SVG so we don't ship fake metrics; this is the
          real replacement. No chart library — one div per day. */}
      <VCard style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Spend Timeline</span>
          <span style={{ fontSize: 13, color: t.textSecondary }}>Per-render charges, last 30 days</span>
          {!usageLoading && !usageError && usageItems.length > 0 && (
            <span style={{ fontSize: 13, color: t.textSecondary, marginLeft: 'auto' }}>
              This month:{' '}
              <span style={{ color: t.text, fontWeight: 700 }}>{usd(spend.monthCents)}</span>
            </span>
          )}
        </div>
        {usageError ? (
          <RetryError
            message={`Couldn't load your spend history (${usageError}).`}
            onRetry={() => setUsageTick((n) => n + 1)}
          />
        ) : usageLoading || usageItems.length === 0 ? (
          <div
            style={{
              height: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderTop: `1px dashed ${t.border}`,
              borderBottom: `1px dashed ${t.border}`,
              color: t.textSecondary,
              textAlign: 'center',
              padding: '0 16px',
            }}
          >
            {usageLoading ? (
              <div style={{ fontSize: 14, fontWeight: 600 }}>…</div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600 }}>No charges yet</div>
                <div style={{ fontSize: 12 }}>
                  Pay only for what you render — every charge lands here, line by line.
                </div>
                <VBtn size="sm" onClick={() => setRoute('create')} style={{ marginTop: 8 }}>
                  Create Video
                </VBtn>
              </>
            )}
          </div>
        ) : (
          <div>
            <div
              style={{
                height: 120,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 3,
                borderBottom: `1px solid ${t.border}`,
                paddingBottom: 1,
              }}
            >
              {spend.days.map((day) => (
                <div
                  key={day.key}
                  title={`${day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${usd(day.cents)}`}
                  style={{
                    flex: 1,
                    height: day.cents > 0
                      ? Math.max(6, Math.round((day.cents / spend.maxDayCents) * 116))
                      : 2,
                    borderRadius: 2,
                    background: day.cents > 0 ? JELLY_TOKENS.gradPrimary : t.border,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: t.textFaint,
                marginTop: 6,
              }}
            >
              <span>30 days ago</span>
              <span>{usd(spend.windowCents)} in window</span>
              <span>Today</span>
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {spend.recent.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontSize: 13,
                    color: t.textSecondary,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.description || it.action}
                  </span>
                  <span style={{ color: t.text, fontWeight: 600 }}>{usd(it.costCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </VCard>

      <Footer />
    </div>
  );
}

/* One hero card: micro-label, gradient icon tile, headline, gradient CTA.
 * `ticket` tints the glass violet/cyan — reserved for the billing card, so
 * the wallet reads as the same object as every receipt in the studio. */
function HeroCard({
  eyebrow,
  icon,
  title,
  body,
  cta,
  onCta,
  variant = 'glass',
}: {
  eyebrow: string;
  icon: IconName;
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
  variant?: 'glass' | 'ticket';
}): React.ReactElement {
  const { t } = useTheme();
  return (
    <GlassCard variant={variant} hover padding={24} halo={variant === 'ticket'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: JELLY_TOKENS.radius.sm,
            background: JELLY_TOKENS.gradPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: JELLY_TOKENS.brandGlow,
          }}
        >
          <Icon name={icon} size={18} color={JELLY_TOKENS.onGradient} />
        </div>
        <MicroLabel tone={variant === 'ticket' ? 'violet' : 'cyan'} size={10.5} tracking="0.22em">
          {eyebrow}
        </MicroLabel>
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: t.text,
          marginTop: 14,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4, lineHeight: 1.55 }}>
        {body}
      </div>
      <VBtn size="sm" onClick={onCta} style={{ marginTop: 16 }}>
        {cta}
      </VBtn>
    </GlassCard>
  );
}
