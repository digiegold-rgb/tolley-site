'use client';

/**
 * ListingProgress — what the agent sees after they pay.
 *
 *   Staging your photo → Your approval → Filming → Finishing
 *
 * Polls GET /api/vater/listing/[id]/poll every 5 s while the machine is
 * working. `awaiting_approval` shows the staged still LARGE with Approve
 * (POST /approve-still) and "Try again (99¢)" (POST /restage). `ready` shows
 * the video (or the still), Download, Copy proof link, MLS-safe export
 * (license-gated) and "Make another". `failed` shows the refund note and the
 * support strip expanded — a real person, right now.
 */
import * as React from 'react';
import type { ListingJobDto, ListingJobStatusValue } from '@/lib/vater/listing/contract';
import { LISTING_SKUS, RESTAGE_PRICE_CENTS, formatListingPrice } from '@/lib/vater/listing-pricing';
import { MoneyConfirmModal, useBillingMode, type MoneyConfirmRequest } from '@/components/vater/editor/MoneyConfirmModal';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme } from '../../theme-context';
import { GlassCard } from '../../cinema';
import { listingApi, listingErrorMessage, proofPageUrl } from './listing-api';
import { useListingPoll, isMovingStatus } from './useListingPoll';
import { SupportStrip } from './SupportStrip';
import { Badge, BigButton, Notice } from './listing-ui';

const PHASES: Array<{ key: string; label: string; sub: string }> = [
  { key: 'staging', label: 'Staging your photo', sub: 'Furnishing the room from your photo' },
  { key: 'approval', label: 'Your approval', sub: 'You say yes before we film' },
  { key: 'filming', label: 'Filming', sub: 'Turning it into video · usually 10–15 min' },
  { key: 'finishing', label: 'Finishing', sub: 'Upscale, label, end card, Fair-Housing check' },
];

function phaseIndex(status: ListingJobStatusValue, isStill: boolean): number {
  switch (status) {
    case 'staging':
      return 0;
    case 'awaiting_approval':
      return 1;
    case 'rendering':
      return 2;
    case 'finishing':
      return 3;
    case 'ready':
      return isStill ? 1 : 4;
    default:
      return 0;
  }
}

export interface ListingProgressProps {
  job: ListingJobDto;
  onJob: (job: ListingJobDto) => void;
  onMakeAnother: () => void;
  licenseVerified: boolean;
}

export default function ListingProgress({ job: initial, onJob, onMakeAnother, licenseVerified }: ListingProgressProps): React.ReactElement {
  const { t } = useTheme();
  const billing = useBillingMode();
  const { job: polled, error: pollErr, setJob } = useListingPoll(initial.id, initial);
  const job = polled ?? initial;
  const [busy, setBusy] = React.useState<'approve' | 'restage' | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [money, setMoney] = React.useState<MoneyConfirmRequest | null>(null);

  React.useEffect(() => {
    if (polled) onJob(polled);
  }, [polled, onJob]);

  const spec = job.sku ? LISTING_SKUS[job.sku] : null;
  const isStill = spec?.kind === 'still';
  const phases = isStill ? PHASES.slice(0, 2) : PHASES;
  const idx = phaseIndex(job.status, !!isStill);
  const moving = isMovingStatus(job.status);

  const approve = async () => {
    setBusy('approve');
    setErr(null);
    try {
      const next = await listingApi.approveStill(job.id);
      setJob(next);
    } catch (e) {
      setErr(listingErrorMessage(e, 'Could not send your approval. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const restageNow = async () => {
    setBusy('restage');
    setErr(null);
    try {
      const next = await listingApi.restage(job.id);
      setJob(next);
    } catch (e) {
      setErr(listingErrorMessage(e, 'Could not start another try. Nothing was charged.'));
    } finally {
      setBusy(null);
    }
  };

  const askRestage = () => {
    setMoney({
      title: `Try the staging again — ${formatListingPrice(RESTAGE_PRICE_CENTS)}`,
      lines: ['We stage the same photo again with a fresh roll. The current version stays until you approve one.', 'Small charge because a new still is generated.'],
      unitCents: RESTAGE_PRICE_CENTS,
      unitLabel: 'photo',
      count: 1,
      estCostCents: 9,
      confirmLabel: billing.unmetered ? undefined : `Pay ${formatListingPrice(RESTAGE_PRICE_CENTS)}`,
      onConfirm: () => void restageNow(),
    });
  };

  const proofUrl = job.proofToken ? proofPageUrl(job.proofToken) : null;
  const copyProof = async () => {
    if (!proofUrl) return;
    try {
      await navigator.clipboard.writeText(proofUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link:', proofUrl);
    }
  };

  const mediaUrl = job.finalUrl ?? job.videoUrl ?? null;
  const stillUrl = job.stagedStillLabeledUrl ?? job.stagedStillUrl ?? null;
  const original = job.sourceImageUrls?.[0] ?? null;
  const downloadUrl = mediaUrl ?? stillUrl;

  const wrap: React.CSSProperties = { maxWidth: 1040, margin: '0 auto', padding: '8px 12px 48px', fontFamily: JELLY_TOKENS.font, fontSize: 18, color: t.text, display: 'grid', gap: 18 };

  return (
    <div style={wrap} data-testid="listing-progress" data-status={job.status}>
      {/* ladder */}
      <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="22px 24px" shadow>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{spec?.label ?? 'Your listing'}{job.address ? ` · ${job.address}` : ''}</div>
          {job.status === 'ready' ? <Badge tone="ok">Done</Badge> : job.status === 'failed' ? <Badge tone="warn">Did not finish</Badge> : job.status === 'cancelled' ? <Badge tone="faint">Cancelled</Badge> : <Badge tone="brand">{moving ? 'Working…' : 'Waiting for you'}</Badge>}
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))`, gap: 10 }} aria-label="Progress">
          {phases.map((p, i) => {
            const done = job.status === 'ready' ? true : i < idx;
            const active = job.status !== 'ready' && job.status !== 'failed' && job.status !== 'cancelled' && i === idx;
            const color = done ? JELLY_TOKENS.success : active ? JELLY_TOKENS.cyan : t.textDisabled;
            return (
              <li key={p.key} data-testid={`listing-phase-${p.key}`} data-state={done ? 'done' : active ? 'active' : 'pending'} style={{ display: 'grid', gap: 6 }}>
                <div style={{ height: 6, borderRadius: 999, background: done ? JELLY_TOKENS.success : active ? JELLY_TOKENS.gradPrimary : t.border }} className={active && moving ? 'jc-blink' : undefined} />
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{done ? '✓ ' : active ? '● ' : ''}{p.label}</div>
                <div style={{ fontSize: 14, color: t.textFaint, lineHeight: 1.35 }}>{p.sub}</div>
              </li>
            );
          })}
        </ol>
        {moving && (
          <div style={{ marginTop: 14, fontSize: 16, color: t.textSecondary }} aria-live="polite">
            {job.status === 'staging'
              ? 'Staging usually takes about a minute.'
              : 'Filming and finishing usually take 10–15 minutes.'}{' '}
            You can close this tab — it’s saved in <strong>My listings</strong> and will be there when it’s done.
          </div>
        )}
        {pollErr && <div style={{ marginTop: 10, fontSize: 15, color: JELLY_TOKENS.warning }}>{pollErr}</div>}
      </GlassCard>

      {/* approval */}
      {job.status === 'awaiting_approval' && (
        <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="22px 24px" shadow data-testid="listing-approval">
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Here’s your staged photo. Happy with it?</div>
          <div style={{ fontSize: 17, color: t.textSecondary, marginBottom: 16 }}>
            {isStill ? 'Approve to get the final files (labeled social version + MLS-safe version).' : 'Approve and we film the video from it. Nothing more is charged for the video — it was included.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: original ? 'minmax(0, 1fr) minmax(0, 2fr)' : '1fr', gap: 14, alignItems: 'start' }} className="listing-approval-grid">
            {original && (
              <figure style={{ margin: 0, ...glass(t), borderRadius: JELLY_TOKENS.radius.lg, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={original} alt="Original photo" style={{ display: 'block', width: '100%', height: 'auto' }} />
                <figcaption style={{ fontSize: 14, color: t.textFaint, padding: '8px 12px' }}>Before — your photo</figcaption>
              </figure>
            )}
            {stillUrl && (
              <figure style={{ margin: 0, ...glass(t), borderRadius: JELLY_TOKENS.radius.lg, overflow: 'hidden', border: `2px solid ${JELLY_TOKENS.brand}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillUrl} alt="Staged photo" data-testid="listing-staged-still" style={{ display: 'block', width: '100%', height: 'auto' }} />
                <figcaption style={{ fontSize: 14, color: t.textFaint, padding: '8px 12px' }}>After — staged · label burned on frame</figcaption>
              </figure>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <BigButton onClick={() => void approve()} busy={busy === 'approve'} disabled={busy !== null} data-testid="listing-approve-still">
              ✓ Approve{isStill ? '' : ' and film it'}
            </BigButton>
            <BigButton variant="ghost" onClick={askRestage} disabled={busy !== null} busy={busy === 'restage'} data-testid="listing-restage">
              Try again ({formatListingPrice(RESTAGE_PRICE_CENTS)})
            </BigButton>
            {job.restageCount > 0 && <span style={{ alignSelf: 'center', fontSize: 15, color: t.textFaint }}>Tried {job.restageCount} extra time{job.restageCount === 1 ? '' : 's'}</span>}
          </div>
          {err && <Notice tone="block" style={{ marginTop: 12 }}>{err}</Notice>}
        </GlassCard>
      )}

      {/* ready */}
      {job.status === 'ready' && (
        <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="22px 24px" shadow halo data-testid="listing-ready">
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>It’s ready. 🎉</div>
          <div style={{ fontSize: 17, color: t.textSecondary, marginBottom: 16 }}>
            Download it, post it, or share the proof page so anyone can see the original next to the {isStill ? 'staged photo' : 'video'}.
          </div>
          <div style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, overflow: 'hidden', background: t.cardAlt, maxWidth: 880 }}>
            {mediaUrl ? (
              <video data-testid="listing-video" controls playsInline preload="metadata" poster={stillUrl ?? undefined} src={mediaUrl} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 560 }} />
            ) : stillUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stillUrl} alt="Staged photo" data-testid="listing-final-still" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 560, objectFit: 'contain' }} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: t.textFaint }}>Your file is on its way — refresh in a moment.</div>
            )}
          </div>
          {job.videoVerticalUrl && (
            <div style={{ marginTop: 10, fontSize: 16 }}>
              <a href={job.videoVerticalUrl} download style={{ color: JELLY_TOKENS.brandLight }}>Download the vertical Reel (9:16) →</a>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            {downloadUrl && (
              <a href={downloadUrl} download target="_blank" rel="noreferrer" data-testid="listing-download" style={{ textDecoration: 'none' }}>
                <BigButton>⬇ Download</BigButton>
              </a>
            )}
            {proofUrl && (
              <BigButton variant="outline" onClick={() => void copyProof()} data-testid="listing-copy-proof">
                {copied ? '✓ Copied' : '🔗 Copy proof link'}
              </BigButton>
            )}
            {(job.mlsSafeStillUrl || job.sku === 'virtual_staging') && (
              licenseVerified ? (
                <a href={listingApi.mlsExportUrl(job.id)} data-testid="listing-mls-export" style={{ textDecoration: 'none' }}>
                  <BigButton variant="outline">MLS-safe export</BigButton>
                </a>
              ) : (
                <BigButton variant="outline" disabled title="Verify your license (step 3) to unlock" data-testid="listing-mls-export">
                  MLS-safe export · verify license first
                </BigButton>
              )
            )}
            <BigButton variant="ghost" onClick={onMakeAnother} data-testid="listing-make-another">＋ Make another</BigButton>
          </div>
          <div style={{ marginTop: 16, display: 'grid', gap: 6, fontSize: 15, color: t.textFaint }}>
            <div>✓ Equal Housing Opportunity on the end card · ✓ “Virtually staged” label on frame · ✓ your broker line per {job.state ? `${job.state} rules` : 'your state rules'}</div>
            {spec?.materialChange && <div>Social & marketing use — not for MLS photo slots. The proof page pairs it with your original photo.</div>}
            {proofUrl && <div style={{ wordBreak: 'break-all' }}>Proof page: {proofUrl}</div>}
          </div>
        </GlassCard>
      )}

      {/* failed */}
      {(job.status === 'failed' || job.status === 'cancelled') && (
        <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="22px 24px" shadow data-testid="listing-failed">
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>{job.status === 'cancelled' ? 'This one was cancelled.' : 'This one didn’t finish.'}</div>
          <Notice tone="ok" testId="listing-refund-note">
            <strong>You were not charged.</strong> {job.status === 'failed' ? 'The credit for this job went straight back to your balance.' : 'Nothing was billed for a cancelled job.'}
            {job.errorCode === 'moderation' && ' The video model refused the photo — usually because a person, pet or text is in the frame. Try a photo of just the room.'}
            {job.errorCode === 'qa_geometry' && ' Our check found the room changed shape too much. A brighter, straighter photo usually fixes it.'}
            {job.errorCode === 'compliance' && ' The Fair-Housing or MLS check stopped it. Re-read the details on step 3.'}
            {job.errorMessage && !['moderation', 'qa_geometry', 'compliance'].includes(job.errorCode ?? '') && ` ${job.errorMessage}`}
          </Notice>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <BigButton onClick={onMakeAnother} data-testid="listing-make-another">Try with another photo</BigButton>
          </div>
          <SupportStrip expanded style={{ marginTop: 18 }} smsBody={`Listing Studio — my job ${job.id} did not finish`} />
        </GlassCard>
      )}

      {job.status !== 'failed' && job.status !== 'cancelled' && <SupportStrip smsBody={`Listing Studio help — job ${job.id}`} />}

      <MoneyConfirmModal request={money} billing={billing} onClose={() => setMoney(null)} />
      <style>{`@media (max-width: 720px) { .listing-approval-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
