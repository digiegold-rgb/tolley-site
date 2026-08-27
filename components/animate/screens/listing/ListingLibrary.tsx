'use client';

/**
 * ListingLibrary — "My listings". Cards from GET /api/vater/listing; click →
 * `#r=listing&p=<id>` (the wizard resumes a draft, or shows progress/result).
 */
import * as React from 'react';
import type { ListingJobDto, ListingJobStatusValue } from '@/lib/vater/listing/contract';
import { LISTING_SKUS, formatListingPrice } from '@/lib/vater/listing-pricing';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { RetryError } from '../../primitives';
import { listingApi, listingErrorMessage } from './listing-api';
import { SupportStrip } from './SupportStrip';
import { Badge, BigButton } from './listing-ui';

const STATUS_LABEL: Record<ListingJobStatusValue, { text: string; tone: 'ok' | 'warn' | 'brand' | 'faint' }> = {
  draft: { text: 'Draft — keep going', tone: 'faint' },
  staging: { text: 'Staging…', tone: 'brand' },
  awaiting_approval: { text: 'Needs your approval', tone: 'warn' },
  rendering: { text: 'Filming…', tone: 'brand' },
  finishing: { text: 'Finishing…', tone: 'brand' },
  ready: { text: 'Ready', tone: 'ok' },
  failed: { text: 'Did not finish — refunded', tone: 'warn' },
  cancelled: { text: 'Cancelled', tone: 'faint' },
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ListingLibrary(): React.ReactElement {
  const { t } = useTheme();
  const route = useRoute();
  const [jobs, setJobs] = React.useState<ListingJobDto[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setErr(null);
    try {
      const list = await listingApi.list();
      setJobs([...list].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)));
    } catch (e) {
      setErr(listingErrorMessage(e, 'Could not load your listings.'));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const open = (id: string | null) => {
    route.setSelectedProjectId(id);
    route.setRoute('listing');
    if (typeof window !== 'undefined') window.location.hash = id ? `r=listing&p=${encodeURIComponent(id)}` : 'r=listing';
  };

  return (
    <div data-testid="listing-library" style={{ maxWidth: 1040, margin: '0 auto', padding: '8px 12px 48px', fontFamily: JELLY_TOKENS.font, fontSize: 18, color: t.text, display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(26px, 3.4vw, 34px)', fontWeight: 700, letterSpacing: '-0.02em' }}>My listings</h1>
          <div style={{ fontSize: 16, color: t.textSecondary, marginTop: 4 }}>Every photo and video you’ve made here. Tap one to open it.</div>
        </div>
        <BigButton onClick={() => open(null)} data-testid="listing-new">＋ Make a listing video</BigButton>
      </div>

      {err && <RetryError message={err} onRetry={() => void load()} variant="banner" />}

      {jobs === null && !err && <div style={{ color: t.textSecondary }}>Loading…</div>}

      {jobs && jobs.length === 0 && (
        <div style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.xxl, padding: '40px 24px', textAlign: 'center', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 44 }} aria-hidden>🏠</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Nothing here yet</div>
          <div style={{ fontSize: 17, color: t.textSecondary }}>Your first one takes about two minutes: one photo, the address, pick a video, pay.</div>
          <div><BigButton onClick={() => open(null)}>Start your first listing</BigButton></div>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {jobs.map((j) => {
            const spec = j.sku ? LISTING_SKUS[j.sku] : null;
            const thumb = j.stagedStillLabeledUrl ?? j.stagedStillUrl ?? j.sourceImageUrls?.[0] ?? null;
            const s = STATUS_LABEL[j.status] ?? STATUS_LABEL.draft;
            return (
              <div
                key={j.id}
                role="button"
                tabIndex={0}
                data-testid="listing-card"
                data-status={j.status}
                onClick={() => open(j.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(j.id);
                  }
                }}
                className="jc-glass-hover"
                style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, overflow: 'hidden', cursor: 'pointer', display: 'grid', gridTemplateRows: '160px auto' }}
              >
                <div style={{ background: t.cardAlt, position: 'relative' }}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.textFaint, fontSize: 15 }}>No photo yet</div>
                  )}
                  {j.status === 'ready' && (j.finalUrl || j.videoUrl) && (
                    <span aria-hidden style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 13 }}>▶ video</span>
                  )}
                </div>
                <div style={{ padding: '12px 14px', display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.address || spec?.label || 'Untitled listing'}</div>
                    {j.priceCents > 0 && <div className="jc-tabular" style={{ fontSize: 15, color: t.textSecondary, whiteSpace: 'nowrap' }}>{formatListingPrice(j.priceCents)}</div>}
                  </div>
                  <div style={{ fontSize: 14.5, color: t.textFaint }}>{spec?.label ?? 'Not chosen yet'}{j.city ? ` · ${j.city}${j.state ? `, ${j.state}` : ''}` : ''} · {when(j.updatedAt || j.createdAt)}</div>
                  <div><Badge tone={s.tone}>{s.text}</Badge></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SupportStrip />
    </div>
  );
}
