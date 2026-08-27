'use client';

/**
 * Step 4 — Video type. One card per SKU from LISTING_SKUS (the price list is
 * the only source of prices). P1/P2 SKUs render disabled with "Coming soon";
 * material-change SKUs carry the Heartland MLS §11.2.2 badge.
 */
import * as React from 'react';
import type { ListingJobDraft, ListingJobDto } from '@/lib/vater/listing/contract';
import { LISTING_SKUS, LISTING_SKU_IDS, formatListingPrice, type ListingSku } from '@/lib/vater/listing-pricing';
import { useTheme } from '../../../theme-context';
import { Badge, BigButton, Notice, OptionCard, StepHeader, StepNav } from '../listing-ui';

export interface TypeStepProps {
  job: ListingJobDto;
  onSave: (patch: ListingJobDraft) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export const MATERIAL_CHANGE_BADGE = 'For social & marketing — not for MLS photo slots';

export default function TypeStep({ job, onSave, onNext, onBack }: TypeStepProps): React.ReactElement {
  const { t } = useTheme();
  const [sku, setSku] = React.useState<ListingSku | null>(job.sku);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const photos = job.sourceImageUrls?.length ?? 0;

  const pick = async (id: ListingSku) => {
    setSku(id);
    setErr(null);
    try {
      await onSave({ sku: id, step: 4 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save your choice.');
    }
  };

  const next = async () => {
    if (!sku) {
      setErr('Pick one video type to continue.');
      return;
    }
    setBusy(true);
    try {
      await onSave({ sku, step: 4 });
      onNext();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="listing-step-4">
      <StepHeader step={4} title="What should we make?" lede="Pick one. The price is the whole price — no subscription, and a failed render is never charged." />
      <div role="radiogroup" aria-label="Video type" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {LISTING_SKU_IDS.map((id) => {
          const spec = LISTING_SKUS[id];
          const soon = spec.phase !== 'p0';
          const tooFewPhotos = !soon && photos < spec.minPhotos;
          const priceLabel = spec.economyPriceCents ? `from ${formatListingPrice(spec.economyPriceCents)}` : formatListingPrice(spec.priceCents);
          return (
            <OptionCard
              key={id}
              testId={`listing-sku-${id}`}
              on={sku === id}
              disabled={soon}
              onClick={() => void pick(id)}
              title={spec.label}
              price={soon ? undefined : priceLabel}
              blurb={
                <>
                  {spec.blurb}
                  <div style={{ marginTop: 6, fontSize: 15, color: t.textFaint }}>
                    {spec.kind === 'still' ? 'A photo' : `A ${spec.durationS ?? ''}-second video`} · ready in {spec.etaLabel}
                    {spec.perExtraPhotoCents && spec.includedPhotos ? ` · ${spec.includedPhotos} rooms included, +${formatListingPrice(spec.perExtraPhotoCents)} each after` : ''}
                  </div>
                </>
              }
              badge={
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {soon && <Badge tone="faint">Coming soon</Badge>}
                  {spec.materialChange && <Badge tone="warn">{MATERIAL_CHANGE_BADGE}</Badge>}
                  {!spec.materialChange && !soon && <Badge tone="ok">MLS-safe copy included</Badge>}
                  {tooFewPhotos && <Badge tone="warn">Needs {spec.minPhotos} photos</Badge>}
                </div>
              }
            />
          );
        })}
      </div>

      {sku && LISTING_SKUS[sku].materialChange && (
        <Notice tone="warn" testId="listing-material-change-note" style={{ marginTop: 16, maxWidth: 760 }}>
          <strong>Heads up:</strong> this video shows changes to the home itself (walls, floors, finishes). Post it on your socials and marketing — do not upload it into the MLS photo slots. We label it on-frame and pair it with your original photo so it is disclosed properly.
        </Notice>
      )}
      {err && <Notice tone="block" style={{ marginTop: 12 }}>{err}</Notice>}

      <StepNav
        onBack={onBack}
        next={
          <BigButton onClick={() => void next()} busy={busy} disabled={!sku} data-testid="listing-next">
            Next: look & price →
          </BigButton>
        }
      />
    </div>
  );
}
