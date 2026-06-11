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
import { Footer } from '../Footer';
import { StylePickerModal } from './dashboard/StylePickerModal';

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
  const { setRoute, openProjectInEditor, newVideoRequest, consumeNewVideoRequest } = useRoute();
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
        <h2 style={{ fontSize: 28, fontWeight: 700, color: t.text, margin: 0 }}>Dashboard</h2>
        <p style={{ fontSize: 14, color: t.textSecondary, margin: '4px 0 0' }}>
          Create and manage your video styles and voice clones
        </p>
      </div>

      {/* Hero Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        <div
          style={{
            background: JELLY_TOKENS.gradCreate,
            borderRadius: JELLY_TOKENS.radius.xl,
            padding: 24,
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>Create Video</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            Start a new video project
          </div>
          <VBtn
            variant="white"
            size="sm"
            onClick={() => setStylePickerOpen(true)}
            style={{ marginTop: 16 }}
          >
            Create Video
          </VBtn>
        </div>
        <div
          style={{
            background: JELLY_TOKENS.gradCredits,
            borderRadius: JELLY_TOKENS.radius.xl,
            padding: 24,
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>Buy Credits</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            Get more credits to create unlimited videos
          </div>
          <VBtn
            variant="white"
            size="sm"
            onClick={() => setRoute('pricing')}
            style={{ marginTop: 16 }}
          >
            Purchase Credits
          </VBtn>
        </div>
        <div
          style={{
            background: JELLY_TOKENS.gradUpgrade,
            borderRadius: JELLY_TOKENS.radius.xl,
            padding: 24,
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>Upgrade Plan</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            Unlock premium features and more credits
          </div>
          <VBtn
            variant="white"
            size="sm"
            onClick={() => setRoute('pricing')}
            style={{ marginTop: 16 }}
          >
            View Plans
          </VBtn>
        </div>
      </div>

      {/* KPI + Tutorial row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1.2fr',
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
        <div
          style={{
            background: JELLY_TOKENS.gradTutorial,
            borderRadius: JELLY_TOKENS.radius.xl,
            padding: 24,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.2)',
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            TUTORIAL
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Icon name="play" size={24} color="#fff" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
            Getting Started with Jelly
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, textAlign: 'center', marginTop: 4 }}>
            Learn how every part of our platform works
          </div>
        </div>
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
