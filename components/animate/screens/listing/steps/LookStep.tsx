'use client';

/**
 * Step 5 — Look & price. Look (Photoreal / 3D render / Blueprint / B&W),
 * engine (Photoreal Seedance vs Economy when the SKU offers it), MLS-safe
 * export toggle (license-gated), optional vertical Reel add-on, the ADMIT ONE
 * price ticket, and THE money gate:
 *
 *   Pay → GET /preflight (blockers? show them with "go to step N")
 *       → MoneyConfirmModal at LIST price (lines from preflight)
 *       → POST /stage → parent swaps to ListingProgress
 *   402 insufficient_credits → credit-pack buy flow (POST /billing/packs
 *   with returnTo '/realestateanimated') — the wizard's own small modal,
 *   because BillingBlockModal's CTA routes to the /animate pricing screen.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { ListingBlocker, ListingJobDraft, ListingJobDto, ListingPreflight } from '@/lib/vater/listing/contract';
import type { ListingEngine, ListingLook } from '@/lib/vater/listing-pricing';
import { LISTING_SKUS, REEL_ADDON_CENTS, formatListingPrice, listingEstCostCents, listingPriceCents } from '@/lib/vater/listing-pricing';
import { CREDIT_PACKS, packCreditsCents } from '@/lib/vater/credit-packs';
import { STUDIO_HOME } from '@/lib/vater/product';
import { MoneyConfirmModal, useBillingMode, type MoneyConfirmRequest } from '@/components/vater/editor/MoneyConfirmModal';
import { JELLY_TOKENS, glass } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { AdmitOneTicket, type TicketNote, type TicketRow } from '../../../cinema';
import { listingApi, isListingApiError, listingErrorMessage } from '../listing-api';
import { Badge, BigButton, Notice, OptionCard, StepHeader, StepNav } from '../listing-ui';

const LOOKS: Array<{ id: ListingLook; title: string; blurb: string }> = [
  { id: 'photoreal', title: 'Photoreal', blurb: 'Looks like a real photo of the finished room. The one most agents pick.' },
  { id: 'render3d', title: '3D render', blurb: 'Clean architectural-render look. Great for new construction and build-outs.' },
  { id: 'blueprint', title: 'Blueprint sketch', blurb: 'Blue-line drawing that resolves into the room. Eye-catching on social.' },
  { id: 'bw', title: 'Black & white drawing', blurb: 'Pencil sketch that fills in with colour. Classic, quiet, elegant.' },
];

export interface LookStepProps {
  job: ListingJobDto;
  onSave: (patch: ListingJobDraft) => Promise<void>;
  onBack: () => void;
  /** Parent swaps to ListingProgress with the returned job. */
  onStaged: (job: ListingJobDto) => void;
  onGoToStep: (step: number) => void;
  licenseVerified: boolean;
}

export default function LookStep({ job, onSave, onBack, onStaged, onGoToStep, licenseVerified }: LookStepProps): React.ReactElement {
  const { t } = useTheme();
  const billing = useBillingMode();
  const sku = job.sku;
  const spec = sku ? LISTING_SKUS[sku] : null;
  const isStill = spec?.kind === 'still';

  const [look, setLook] = React.useState<ListingLook>(job.look ?? 'photoreal');
  const [engine, setEngine] = React.useState<ListingEngine>(job.engine ?? 'seedance');
  const [mls, setMls] = React.useState(job.lane === 'mls');
  const [reel, setReel] = React.useState(!!job.reel);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [blockers, setBlockers] = React.useState<ListingBlocker[]>([]);
  const [preflight, setPreflight] = React.useState<ListingPreflight | null>(null);
  const [money, setMoney] = React.useState<MoneyConfirmRequest | null>(null);
  const [packsOpen, setPacksOpen] = React.useState<{ needCents?: number; balanceCents?: number } | null>(null);

  const hasEconomy = !!spec?.economyPriceCents;
  const effectiveEngine: ListingEngine = hasEconomy ? engine : 'seedance';
  const photos = job.sourceImageUrls?.length ?? 1;
  const priceCents = sku ? listingPriceCents(sku, { engine: effectiveEngine, photos, reel: reel && !isStill }) : 0;
  const estCostCents = sku ? listingEstCostCents(sku, { engine: effectiveEngine, photos, reel: reel && !isStill }) : 0;
  const reelCents = sku && !isStill ? (sku === 'beauty_shot' ? REEL_ADDON_CENTS.beauty : effectiveEngine === 'modal-wan' ? REEL_ADDON_CENTS.video_economy : REEL_ADDON_CENTS.video_photoreal) : 0;

  // Autosave each choice so a refresh keeps them.
  const persist = React.useCallback(
    (patch: ListingJobDraft) => {
      void onSave({ ...patch, step: 5 }).catch(() => {
        /* Pay re-saves everything; a dropped autosave is not fatal. */
      });
    },
    [onSave],
  );

  const rows: TicketRow[] = [];
  if (spec && sku) {
    const base = listingPriceCents(sku, { engine: effectiveEngine, photos });
    rows.push({ key: 'sku', label: `${spec.label}${hasEconomy ? (effectiveEngine === 'modal-wan' ? ' · Economy' : ' · Photoreal') : ''}`, usd: base / 100 });
    if (reel && !isStill) rows.push({ key: 'reel', label: 'Vertical Reel (9:16) add-on', usd: reelCents / 100 });
  }
  const notes: TicketNote[] = [
    { label: 'Fair-Housing check', value: 'on every export', tone: 'cyan' },
    { label: 'Label on frame', value: spec?.materialChange ? 'AI-generated · virtually staged' : 'virtually staged', tone: 'faint' },
    { label: 'Failed render', value: 'never charged', tone: 'cyan' },
  ];
  if (preflight?.unmetered) notes.push({ label: 'billing', value: 'unmetered account — no credit needed', tone: 'cyan' });
  else if (preflight && typeof preflight.balanceCents === 'number') notes.push({ label: 'your balance', value: `$${(preflight.balanceCents / 100).toFixed(2)}` });

  const stageNow = async () => {
    if (!sku) return;
    setBusy(true);
    setErr(null);
    try {
      const next = await listingApi.stage(job.id);
      onStaged(next);
    } catch (e) {
      if (isListingApiError(e) && e.insufficientCredits) {
        setPacksOpen({ needCents: e.needCents ?? priceCents, balanceCents: preflight?.balanceCents });
      } else if (isListingApiError(e) && e.blockers.length) {
        setBlockers(e.blockers);
      } else {
        setErr(listingErrorMessage(e, 'We could not start the job. Nothing was charged.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!sku || !spec) {
      setErr('Go back one step and pick a video type.');
      return;
    }
    setBusy(true);
    setErr(null);
    setBlockers([]);
    try {
      await onSave({ look, engine: effectiveEngine, lane: mls ? 'mls' : 'social', reel: reel && !isStill, step: 5 });
      const pf = await listingApi.preflight(job.id);
      setPreflight(pf);
      if (!pf.ok || pf.blockers.length) {
        const credit = pf.blockers.find((b) => b.code === 'insufficient_credits');
        const others = pf.blockers.filter((b) => b.code !== 'insufficient_credits');
        if (others.length) {
          setBlockers(others);
          return;
        }
        if (credit) {
          setPacksOpen({ needCents: pf.priceCents - pf.balanceCents, balanceCents: pf.balanceCents });
          return;
        }
      }
      const unit = pf.priceCents || priceCents;
      setMoney({
        title: `${spec.label} — ${formatListingPrice(unit)}`,
        lines: pf.lines?.length
          ? pf.lines
          : [
              `${spec.label} (${LOOKS.find((l) => l.id === look)?.title ?? look}) from your photo.`,
              'Fair-Housing check: passed. Label burned on frame. Equal Housing Opportunity on the end card.',
              `Ready in ${spec.etaLabel}. You approve the staged photo before any video is filmed.`,
            ],
        unitCents: unit,
        unitLabel: isStill ? 'photo' : 'video',
        count: 1,
        estCostCents: pf.estCostCents || estCostCents,
        confirmLabel: billing.unmetered ? undefined : `Pay ${formatListingPrice(unit)}`,
        onConfirm: () => void stageNow(),
      });
    } catch (e) {
      if (isListingApiError(e) && e.insufficientCredits) {
        setPacksOpen({ needCents: e.needCents ?? priceCents });
      } else if (isListingApiError(e) && e.code === 'feature_not_ready') {
        setErr('Listing Studio is finishing setup on our side — text us and we’ll run this one for you.');
      } else {
        setErr(listingErrorMessage(e, 'Could not check this job. Nothing was charged.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const card: React.CSSProperties = { ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, padding: 20, display: 'grid', gap: 12 };

  return (
    <div data-testid="listing-step-5">
      <StepHeader step={5} title="Pick the look, then pay" lede={spec ? `${spec.label} · ${spec.blurb}` : 'Go back and pick a video type first.'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)', gap: 20, alignItems: 'start' }} className="listing-look-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Look */}
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: t.text, marginBottom: 10 }}>Look</div>
            <div role="radiogroup" aria-label="Look" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {LOOKS.map((l) => (
                <OptionCard
                  key={l.id}
                  testId={`listing-look-${l.id}`}
                  on={look === l.id}
                  title={l.title}
                  blurb={l.blurb}
                  onClick={() => {
                    setLook(l.id);
                    persist({ look: l.id });
                  }}
                />
              ))}
            </div>
          </div>

          {/* Engine */}
          {hasEconomy && spec && sku && (
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: t.text, marginBottom: 10 }}>Engine</div>
              <div role="radiogroup" aria-label="Engine" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <OptionCard
                  testId="listing-engine-seedance"
                  on={engine === 'seedance'}
                  title="Photoreal (Seedance)"
                  price={formatListingPrice(spec.priceCents)}
                  blurb="Our best-looking engine. Smooth, realistic transformation with room tone. 1080p."
                  onClick={() => {
                    setEngine('seedance');
                    persist({ engine: 'seedance' });
                  }}
                />
                <OptionCard
                  testId="listing-engine-economy"
                  on={engine === 'modal-wan'}
                  title="Economy"
                  price={formatListingPrice(spec.economyPriceCents ?? 0)}
                  blurb="Same idea, simpler motion. Good for a quick social post when budget matters."
                  onClick={() => {
                    setEngine('modal-wan');
                    persist({ engine: 'modal-wan' });
                  }}
                />
              </div>
            </div>
          )}

          {/* Options */}
          <div style={card}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 17, color: t.text, cursor: licenseVerified ? 'pointer' : 'not-allowed', opacity: licenseVerified ? 1 : 0.6 }}>
              <input
                type="checkbox"
                data-testid="listing-mls-safe"
                checked={mls}
                disabled={!licenseVerified}
                onChange={(e) => {
                  setMls(e.target.checked);
                  persist({ lane: e.target.checked ? 'mls' : 'social' });
                }}
                style={{ width: 24, height: 24, marginTop: 2 }}
              />
              <span>
                <strong>Also give me the MLS-safe export</strong>
                <div style={{ fontSize: 15, color: t.textSecondary, marginTop: 2 }}>
                  The bare staged photo with no name, logo or label, plus a “Virtually staged” line for the photo-description field.{' '}
                  {licenseVerified ? '' : <Badge tone="warn">Verify your license on step 3 to unlock</Badge>}
                </div>
              </span>
            </label>
            {!isStill && spec && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 17, color: t.text, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  data-testid="listing-reel"
                  checked={reel}
                  onChange={(e) => {
                    setReel(e.target.checked);
                    persist({ reel: e.target.checked });
                  }}
                  style={{ width: 24, height: 24, marginTop: 2 }}
                />
                <span>
                  <strong>Add a vertical Reel (9:16)</strong> · +{formatListingPrice(reelCents)}
                  <div style={{ fontSize: 15, color: t.textSecondary, marginTop: 2 }}>A second, full re-render framed for Reels, TikTok and Shorts — not a crop.</div>
                </span>
              </label>
            )}
          </div>

          {blockers.length > 0 && (
            <Notice tone="block" testId="listing-blockers">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>A couple of things to fix before we can start:</div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
                {blockers.map((b, i) => (
                  <li key={`${b.code}${i}`}>
                    {b.message}{' '}
                    {b.step >= 1 && b.step <= 4 && (
                      <button type="button" onClick={() => onGoToStep(b.step)} style={{ background: 'none', border: 'none', color: JELLY_TOKENS.brandLight, textDecoration: 'underline', cursor: 'pointer', fontFamily: JELLY_TOKENS.font, fontSize: 16, padding: 0 }}>
                        Go to step {b.step} →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          {err && <Notice tone="block" testId="listing-pay-error">{err}</Notice>}
        </div>

        {/* Ticket */}
        <div style={{ position: 'sticky', top: 16 }} data-slot="pricing-ticket">
          <AdmitOneTicket
            data-testid="listing-price-ticket"
            label="ADMIT ONE — LISTING STUDIO"
            state={spec ? spec.etaLabel.toUpperCase() : undefined}
            totalUsd={priceCents / 100}
            rows={rows}
            notes={notes}
            size="card"
            footer={
              <>
                You pay only when you press Pay. {isStill ? 'The photo' : 'The staged photo'} comes back for your approval first{isStill ? '.' : ' — the video is filmed after you approve it.'}
                {spec?.materialChange ? ' Social & marketing use — not for MLS photo slots.' : ''}
              </>
            }
            action={
              <BigButton full onClick={() => void pay()} busy={busy} disabled={!sku} data-testid="listing-pay">
                Pay {formatListingPrice(priceCents)} and start
              </BigButton>
            }
          />
        </div>
      </div>

      <StepNav onBack={onBack} next={<span style={{ fontSize: 15, color: t.textFaint }}>Nothing is charged until you confirm.</span>} />

      <MoneyConfirmModal request={money} billing={billing} onClose={() => setMoney(null)} />
      {packsOpen && <CreditPacksModal needCents={packsOpen.needCents} balanceCents={packsOpen.balanceCents} onClose={() => setPacksOpen(null)} />}
      <style>{`@media (max-width: 860px) { .listing-look-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

/* ─── credit packs (402 wall) ─── */

function CreditPacksModal({ needCents, balanceCents, onClose }: { needCents?: number; balanceCents?: number; onClose: () => void }): React.ReactElement | null {
  const { t } = useTheme();
  const [busy, setBusy] = React.useState<number | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  if (typeof document === 'undefined') return null;

  const buy = async (pack: number) => {
    setBusy(pack);
    setErr(null);
    try {
      const url = await listingApi.buyPack(pack, STUDIO_HOME.realestate);
      window.location.href = url;
    } catch (e) {
      setErr(listingErrorMessage(e, 'Could not open checkout.'));
      setBusy(null);
    }
  };

  // Suggest the smallest pack that covers the gap.
  const suggested = CREDIT_PACKS.find((p) => packCreditsCents(p) >= (needCents ?? 0)) ?? CREDIT_PACKS[CREDIT_PACKS.length - 1];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Add credit" data-testid="listing-credit-packs" onClick={(e) => e.target === e.currentTarget && busy === null && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 520, background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: JELLY_TOKENS.radius.xxl, padding: 24, fontFamily: JELLY_TOKENS.font, color: t.text, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>Add credit to continue</div>
        <div style={{ fontSize: 17, color: t.textSecondary, lineHeight: 1.5 }}>
          {typeof balanceCents === 'number' ? `Your balance is $${(balanceCents / 100).toFixed(2)}. ` : ''}
          {needCents && needCents > 0 ? `You need about $${(needCents / 100).toFixed(2)} more. ` : ''}
          Credit never expires and a failed render is never charged. Nothing has been charged yet.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
          {CREDIT_PACKS.map((p) => (
            <button
              key={p}
              type="button"
              data-testid={`listing-pack-${p}`}
              onClick={() => void buy(p)}
              disabled={busy !== null}
              style={{
                ...glass(t),
                border: `2px solid ${p === suggested ? JELLY_TOKENS.brand : t.border}`,
                borderRadius: JELLY_TOKENS.radius.lg,
                padding: '16px 10px',
                fontFamily: JELLY_TOKENS.font,
                color: t.text,
                cursor: busy !== null ? 'wait' : 'pointer',
                display: 'grid',
                gap: 4,
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 800 }}>${p}</span>
              <span style={{ fontSize: 13.5, color: t.textFaint }}>${(packCreditsCents(p) / 100).toFixed(2)} credit</span>
              {p === suggested && <span style={{ fontSize: 12.5, color: JELLY_TOKENS.cyan, fontWeight: 600 }}>covers this</span>}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 14, color: t.textFaint }}>The small difference is the card-processing fee — we pass it through at cost. You come straight back here after paying.</div>
        {err && <Notice tone="block">{err}</Notice>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BigButton variant="ghost" onClick={onClose} disabled={busy !== null} style={{ minHeight: 48, padding: '10px 20px', fontSize: 16 }}>Not now</BigButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
