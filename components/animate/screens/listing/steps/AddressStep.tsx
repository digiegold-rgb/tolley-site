'use client';

/**
 * Step 2 — Address. Street / city / state / ZIP. The state is the important
 * one: it picks the advertising rule the end card follows (MO / KS / PA
 * differ — Part B of the plan), and we say so in plain words right here.
 */
import * as React from 'react';
import type { ListingJobDraft, ListingJobDto } from '@/lib/vater/listing/contract';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { BigButton, Field, Notice, Select, StepHeader, StepNav, TextInput, US_STATES, stateAdRule } from '../listing-ui';

export interface AddressStepProps {
  job: ListingJobDto;
  onSave: (patch: ListingJobDraft) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export default function AddressStep({ job, onSave, onNext, onBack }: AddressStepProps): React.ReactElement {
  const { t } = useTheme();
  const [address, setAddress] = React.useState(job.address ?? '');
  const [city, setCity] = React.useState(job.city ?? '');
  const [state, setState] = React.useState((job.state ?? '').toUpperCase());
  const [zip, setZip] = React.useState(job.zip ?? '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const rule = stateAdRule(state);
  const canNext = address.trim().length > 3 && state.length === 2;

  const next = async () => {
    setErr(null);
    if (!canNext) {
      setErr(!state ? 'Pick the state — it decides which advertising rule we follow for you.' : 'Type the street address.');
      return;
    }
    setBusy(true);
    try {
      await onSave({ address: address.trim(), city: city.trim() || null, state, zip: zip.trim() || null, step: 2 });
      onNext();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="listing-step-2">
      <StepHeader step={2} title="Where is the home?" lede="We use the address for the caption and the state for your advertising rules. Nothing here goes on MLS-safe exports." />
      <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <Field label="Street address">
          <TextInput data-testid="listing-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" autoComplete="street-address" autoFocus />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(110px,1fr) minmax(110px,1fr)', gap: 12 }}>
          <Field label="City">
            <TextInput data-testid="listing-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Independence" autoComplete="address-level2" />
          </Field>
          <Field label="State">
            <Select data-testid="listing-state" value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
              <option value="">Pick…</option>
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ZIP">
            <TextInput data-testid="listing-zip" value={zip} onChange={(e) => setZip(e.target.value)} inputMode="numeric" maxLength={10} placeholder="64050" autoComplete="postal-code" />
          </Field>
        </div>

        <Notice tone={state ? 'ok' : 'info'} testId="listing-state-rule">
          <div style={{ fontWeight: 700 }}>{rule.headline}</div>
          {rule.detail && <div style={{ marginTop: 4, fontSize: 15, color: t.textSecondary }}>{rule.detail}</div>}
          <div style={{ marginTop: 6, fontSize: 15, color: t.textSecondary }}>
            Equal Housing Opportunity goes on every video. Your broker details come from your Agent profile on the next step.
          </div>
        </Notice>

        {err && <Notice tone="block" testId="listing-address-error">{err}</Notice>}
      </div>
      <div style={{ fontSize: 14, color: t.textFaint, marginTop: 10, fontFamily: JELLY_TOKENS.font }}>Autosaved when you press Next.</div>
      <StepNav
        onBack={onBack}
        next={
          <BigButton onClick={() => void next()} busy={busy} disabled={!canNext} data-testid="listing-next">
            Next: the details →
          </BigButton>
        }
      />
    </div>
  );
}
