'use client';

/**
 * Step 1 — Photo. Drop / choose / take a photo → POST /api/vater/upload →
 * Blob URL saved on the draft. Or "No photo? Use the address instead" →
 * POST /api/vater/listing/property-image (Street View copy on Blob).
 *
 * One action per screen: the big dashed box IS the button.
 */
import * as React from 'react';
import type { ListingJobDraft, ListingJobDto } from '@/lib/vater/listing/contract';
import { JELLY_TOKENS, glass } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { listingApi, listingErrorMessage } from '../listing-api';
import { BigButton, Field, Notice, Select, StepHeader, StepNav, TextInput, US_STATES } from '../listing-ui';

const MAX_BYTES = 10 * 1024 * 1024;

export interface PhotoStepProps {
  job: ListingJobDto;
  onSave: (patch: ListingJobDraft) => Promise<void>;
  onNext: () => void;
}

export default function PhotoStep({ job, onSave, onNext }: PhotoStepProps): React.ReactElement {
  const { t } = useTheme();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const [addressMode, setAddressMode] = React.useState(false);
  const [addr, setAddr] = React.useState({ address: job.address ?? '', city: job.city ?? '', state: job.state ?? '', zip: job.zip ?? '' });
  const pickRef = React.useRef<HTMLInputElement>(null);
  const camRef = React.useRef<HTMLInputElement>(null);

  const photo = job.sourceImageUrls?.[0] ?? null;

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith('image/')) {
      setErr('That file is not a photo. Please choose a JPG, PNG or HEIC photo.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr('That photo is bigger than 10 MB. Most phones can send a smaller copy — try “Medium” size.');
      return;
    }
    setBusy(true);
    try {
      const url = await listingApi.upload(file);
      await onSave({ sourceKind: 'upload', sourceImageUrls: [url], step: 1 });
    } catch (e) {
      setErr(listingErrorMessage(e, 'The upload did not go through. Please try again.'));
    } finally {
      setBusy(false);
      if (pickRef.current) pickRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  };

  const useAddress = async () => {
    setErr(null);
    if (!addr.address.trim()) {
      setErr('Type the street address first.');
      return;
    }
    setBusy(true);
    try {
      const res = await listingApi.propertyImage({
        address: addr.address.trim(),
        city: addr.city.trim() || undefined,
        state: addr.state || undefined,
        zip: addr.zip.trim() || undefined,
      });
      await onSave({
        sourceKind: 'streetview',
        sourceImageUrls: [res.imageUrl],
        address: addr.address.trim(),
        city: addr.city.trim() || null,
        state: addr.state || null,
        zip: addr.zip.trim() || null,
        lat: res.lat,
        lng: res.lng,
        step: 1,
      });
      setAddressMode(false);
    } catch (e) {
      setErr(listingErrorMessage(e, 'We could not find a street photo for that address. Try uploading a photo instead.'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await onSave({ sourceImageUrls: [], step: 1 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="listing-step-1">
      <StepHeader step={1} title="Add one photo of the room" lede="A phone photo is fine. Empty rooms work best — that is the whole point." />

      {/* Hidden inputs: one opens the camera on phones, one opens the photo library / file picker. */}
      <input ref={pickRef} data-testid="listing-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void handleFile(e.target.files?.[0])} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => void handleFile(e.target.files?.[0])} />

      {photo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, overflow: 'hidden', position: 'relative', maxWidth: 720 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Your room photo" data-testid="listing-photo-preview" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 460, objectFit: 'contain', background: t.cardAlt }} />
            <div style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 14, padding: '6px 10px', borderRadius: JELLY_TOKENS.radius.sm, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
              {job.sourceKind === 'streetview' ? 'Street photo from the address' : 'Your photo'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <BigButton variant="ghost" onClick={() => pickRef.current?.click()} busy={busy} data-testid="listing-photo-replace">Use a different photo</BigButton>
            <BigButton variant="ghost" onClick={() => void clear()} busy={busy}>Remove</BigButton>
          </div>
        </div>
      ) : addressMode ? (
        <div style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, padding: 20, display: 'grid', gap: 14, maxWidth: 640 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: t.text }}>We’ll pull a street photo of the home</div>
          <Field label="Street address">
            <TextInput value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} placeholder="123 Main St" autoComplete="street-address" data-testid="listing-address-fallback" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <Field label="City"><TextInput value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} autoComplete="address-level2" /></Field>
            <Field label="State">
              <Select value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })}>
                <option value="">—</option>
                {US_STATES.map(([c]) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="ZIP"><TextInput value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} inputMode="numeric" autoComplete="postal-code" /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <BigButton onClick={() => void useAddress()} busy={busy} data-testid="listing-use-address">Get the street photo</BigButton>
            <BigButton variant="ghost" onClick={() => setAddressMode(false)} disabled={busy}>Never mind — I have a photo</BigButton>
          </div>
          <div style={{ fontSize: 15, color: t.textFaint }}>Street photos are labeled “AI-generated — rendering” on the video. Good for exterior reveals; for rooms, a real photo is much better.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, maxWidth: 720 }}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Add a photo"
            data-testid="listing-dropzone"
            onClick={() => pickRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pickRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            style={{
              ...glass(t),
              border: `2px dashed ${over ? JELLY_TOKENS.brand : JELLY_TOKENS.brandOutline}`,
              background: over ? JELLY_TOKENS.brandGhost : undefined,
              borderRadius: JELLY_TOKENS.radius.xxl,
              padding: '44px 24px',
              textAlign: 'center',
              cursor: busy ? 'wait' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              color: t.text,
            }}
          >
            <div aria-hidden style={{ fontSize: 46, lineHeight: 1 }}>🏠</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{busy ? 'Uploading your photo…' : 'Tap here to choose a photo'}</div>
            <div style={{ fontSize: 17, color: t.textSecondary }}>or drag one onto this box · JPG, PNG or HEIC · up to 10 MB</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <BigButton onClick={() => pickRef.current?.click()} busy={busy} data-testid="listing-choose-photo">Choose a photo</BigButton>
            <BigButton variant="outline" onClick={() => camRef.current?.click()} busy={busy} data-testid="listing-take-photo">📷 Take a photo</BigButton>
          </div>
          <button
            type="button"
            onClick={() => setAddressMode(true)}
            data-testid="listing-no-photo"
            style={{ background: 'none', border: 'none', color: JELLY_TOKENS.brandLight, fontFamily: JELLY_TOKENS.font, fontSize: 17, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            No photo? Use the address instead →
          </button>
        </div>
      )}

      <div style={{ marginTop: 18, display: 'grid', gap: 10, maxWidth: 720 }}>
        <Notice tone="info">
          <strong>No people in the photo</strong> — no sellers, no kids, no pets in frame. The video model refuses photos with people, and Fair Housing rules keep people out of listing media anyway.
        </Notice>
        {err && <Notice tone="block" testId="listing-photo-error">{err}</Notice>}
      </div>

      <StepNav
        next={
          <BigButton onClick={onNext} disabled={!photo || busy} data-testid="listing-next">
            Next: the address →
          </BigButton>
        }
      />
    </div>
  );
}
