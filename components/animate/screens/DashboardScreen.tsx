'use client';

/* DashboardScreen — ported from vater-screens.jsx lines 4-100.
 * 4 hero cards (Create / Buy Credits / Upgrade / Tutorial),
 * 3 KPI tiles (live from /api/vater/youtube), credit-usage timeline placeholder.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { useTheme, useRoute } from '../theme-context';
import { Icon, type IconName } from '../Icon';
import { VBtn, VCard } from '../primitives';
import { GlassCard, MicroLabel } from '../cinema';
import { Footer } from '../Footer';
import { StylePickerModal } from './dashboard/StylePickerModal';
import { LatestUpdateBanner } from '../LatestUpdate';

interface KpiTile {
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
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

export function DashboardScreen(): React.ReactElement {
  const { t } = useTheme();
  const {
    setRoute,
    openProjectInEditor,
    newVideoRequest,
    consumeNewVideoRequest,
    openHelp,
  } = useRoute();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stylePickerOpen, setStylePickerOpen] = React.useState(false);

  // Sidebar (or any other surface) calling requestNewVideo() bumps the
  // counter — open the picker, then clear the flag so subsequent route
  // changes back to dashboard don't re-pop it.
  React.useEffect(() => {
    if (newVideoRequest > 0) {
      setStylePickerOpen(true);
      consumeNewVideoRequest();
    }
  }, [newVideoRequest, consumeNewVideoRequest]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      } catch {
        /* swallow — KPIs show "—" */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      { label: 'Total Videos', value: fmt(totalVideos), sub: 'All time', icon: 'videoEditor' },
      { label: 'This Month', value: fmt(thisMonth), sub: 'Created this month', icon: 'sparkle' },
      {
        label: 'In Progress',
        value: fmt(inProgress),
        sub: inProgress === 0 ? 'No active jobs' : 'Currently editing',
        icon: 'history',
      },
    ];
  }, [projects, loading]);

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
          onCta={() => setStylePickerOpen(true)}
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

      {!loading && projects.length === 0 && (
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
            <VBtn size="sm" onClick={() => setStylePickerOpen(true)}>
              Create your first video
            </VBtn>
            <VBtn variant="outlined" size="sm" onClick={openHelp}>
              How it works
            </VBtn>
          </div>
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
          <VCard key={i} style={{ padding: 20 }}>
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

      {/* Spend timeline placeholder — Stage 1c wires real data from
          /api/vater/billing/usage. Stage 0 removed the hardcoded "April 2026"
          + 92,202-credit static SVG so we don't ship fake metrics. */}
      <VCard style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Spend Timeline</span>
          <span style={{ fontSize: 13, color: t.textSecondary }}>Per-render charges, last 30 days</span>
        </div>
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
          <div style={{ fontSize: 14, fontWeight: 600 }}>No charges yet</div>
          <div style={{ fontSize: 12 }}>Your render-by-render spend will appear here once you generate your first video.</div>
        </div>
      </VCard>

      <Footer />

      <StylePickerModal
        open={stylePickerOpen}
        onClose={() => setStylePickerOpen(false)}
        onProjectCreated={(projectId) => {
          setStylePickerOpen(false);
          openProjectInEditor(projectId);
        }}
      />
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
