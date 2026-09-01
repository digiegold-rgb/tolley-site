'use client';

/**
 * Dashboard "everything live" strip — all workspace tabs this login owns.
 * Links into Socials per studio (`/animate?w=<tab>#r=socials`).
 * Not the house HQ tables (those mount separately for owners).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { useTier } from '../../tier-context';
import { useProduct } from '../../product-context';
import { VBtn, VCard } from '../../primitives';
import { MicroLabel } from '../../cinema';
import { StudioVideoThumb } from '../socials/StudioVideoThumb';
import type { StudioHighlight, StudioVideo } from '@/lib/vater/socials/studio-library';

interface OverviewStudio {
  userId: string;
  name: string;
  isPrimary: boolean;
  active: boolean;
  videoCount: number;
  readyCount: number;
  postedCount: number;
  topViews: number | null;
  topTitle: string | null;
  videos: StudioVideo[];
}

interface OverviewPayload {
  workspaces?: OverviewStudio[];
  totals?: { videos: number; ready: number; posted: number };
  encouragement?: string;
  highlight?: StudioHighlight | null;
}

function socialsHref(homePath: string, userId: string): string {
  return `${homePath}?w=${encodeURIComponent(userId)}#r=socials`;
}

export function ActiveVideosStrip(): React.ReactElement | null {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const { workspace } = useTier();
  const brand = useProduct();
  const [data, setData] = React.useState<OverviewPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vater/socials/overview', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as OverviewPayload;
        if (!cancelled) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'overview failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err && !data) return null;
  if (!data) {
    return (
      <VCard style={{ marginTop: 24 }} data-testid="active-videos-strip">
        <MicroLabel tone="cyan" style={{ marginBottom: 8 }}>
          All studios
        </MicroLabel>
        <div style={{ fontSize: 14, color: t.textSecondary }}>Loading every live clip…</div>
      </VCard>
    );
  }

  const studios = data.workspaces ?? [];
  const highlight = data.highlight ?? null;
  const totals = data.totals ?? { videos: 0, ready: 0, posted: 0 };

  const openStudioSocials = (userId: string, isActive: boolean) => {
    if (isActive || workspace?.id === userId) {
      setRoute('socials');
      return;
    }
    window.location.assign(socialsHref(brand.homePath, userId));
  };

  return (
    <div data-testid="active-videos-strip" style={{ marginTop: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <MicroLabel tone="cyan" style={{ marginBottom: 6 }}>
            Everything live
          </MicroLabel>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>
            All your active videos
          </div>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: '4px 0 0', maxWidth: 560 }}>
            {data.encouragement ?? 'One place to see what is live and how it is doing.'}
          </p>
        </div>
        {highlight ? (
          <div
            className="jc-blink"
            style={{
              padding: '10px 14px',
              borderRadius: JELLY_TOKENS.radius.lg,
              background: JELLY_TOKENS.brandGhost,
              border: `1px solid ${JELLY_TOKENS.brandOutline}`,
              boxShadow: JELLY_TOKENS.brandGlow,
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: JELLY_TOKENS.brandLight }}>
              {highlight.label.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: JELLY_TOKENS.success,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {highlight.value.toLocaleString()}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          { label: 'Videos', value: totals.videos, color: JELLY_TOKENS.brandLight },
          { label: 'Ready', value: totals.ready, color: JELLY_TOKENS.cyan },
          { label: 'Posted', value: totals.posted, color: JELLY_TOKENS.success },
        ].map((kpi) => (
          <VCard key={kpi.label} style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: t.textSecondary, fontWeight: 700 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value.toLocaleString()}
            </div>
          </VCard>
        ))}
      </div>

      {studios.map((studio) => {
        const winningId =
          studio.videos.find((v) => v.views != null && v.views === studio.topViews)?.id ??
          studio.videos[0]?.id;
        return (
          <VCard key={studio.userId} style={{ marginBottom: 12, padding: 14 }} data-testid={`studio-strip-${studio.userId}`}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: studio.videos.length ? 12 : 0,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
                  {studio.name}
                  {studio.active ? (
                    <span style={{ marginLeft: 8, fontSize: 11, color: JELLY_TOKENS.cyan, fontWeight: 700 }}>
                      this tab
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                  {studio.readyCount} ready · {studio.postedCount} posted
                  {studio.topViews != null ? ` · lead clip ${studio.topViews.toLocaleString()} views` : ''}
                </div>
              </div>
              <VBtn size="sm" variant="ghost" onClick={() => openStudioSocials(studio.userId, studio.active)}>
                {studio.name} Socials
              </VBtn>
            </div>
            {studio.videos.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: JELLY_TOKENS.radius.md,
                  background: JELLY_TOKENS.brandGhost,
                  border: `1px dashed ${JELLY_TOKENS.brandOutline}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>
                  {studio.name} is empty — make a video and this strip lights up.
                </div>
                <VBtn size="sm" onClick={() => setRoute('create')}>
                  Create a video
                </VBtn>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
                  gap: 8,
                }}
              >
                {studio.videos.map((video) => (
                  <StudioVideoThumb
                    key={video.id}
                    video={video}
                    winning={video.id === winningId && (video.views ?? 0) > 0}
                    dense
                    onClick={() => openStudioSocials(studio.userId, studio.active)}
                  />
                ))}
              </div>
            )}
          </VCard>
        );
      })}
    </div>
  );
}
