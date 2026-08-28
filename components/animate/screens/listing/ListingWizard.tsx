'use client';

/**
 * ListingWizard — the five-step "upload photo → click → pay → done" front door
 * of Listing Studio by Jelly! (tolley.io/realestateanimated).
 *
 *   1 Photo · 2 Address · 3 Details · 4 Video type · 5 Look & price
 *
 * No `jobId` → creates a draft on mount (POST /api/vater/listing) and writes
 * `#r=listing&p=<id>` through the Shell's route context (the same hash the
 * Shell reads back as selectedProjectId), so a refresh resumes the draft.
 * Every step autosaves with PATCH. Once the job leaves `draft` the wizard
 * hands over to <ListingProgress/>.
 */
import * as React from 'react';
import type { AgentProfile, ListingJobDraft, ListingJobDto } from '@/lib/vater/listing/contract';
import { LISTING_STEPS } from '@/lib/vater/listing/contract';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { useTier, type TierContextValue } from '../../tier-context';
import { PillStepper, RetryError } from '../../primitives';
import { GlassCard } from '../../cinema';
import { listingApi, listingErrorMessage } from './listing-api';
import { SupportStrip } from './SupportStrip';
import ListingProgress from './ListingProgress';
import PhotoStep from './steps/PhotoStep';
import AddressStep from './steps/AddressStep';
import DetailsStep from './steps/DetailsStep';
import TypeStep from './steps/TypeStep';
import LookStep from './steps/LookStep';

const STEP_HINTS: readonly string[] = [
  'One photo of the room. Phone photos are fine. No people in the shot.',
  'Street, city, state, ZIP. The state picks the advertising rule we follow for you.',
  'Beds, baths, square feet, features. Speak or type. Fair-Housing check runs as you go.',
  'Pick one: a staged photo, a before→after video, a beauty shot.',
  'Choose the look, see the price, pay. You approve the staged photo before anything is filmed.',
];

/** tier-context is being extended by the API workstream — read the new fields defensively. */
type TierWithListing = TierContextValue & {
  product?: string;
  agentProfile?: AgentProfile | null;
  capabilities: TierContextValue['capabilities'] & { license?: boolean };
};

export interface ListingWizardProps {
  jobId?: string | null;
}

export default function ListingWizard({ jobId }: ListingWizardProps): React.ReactElement {
  const { t } = useTheme();
  const route = useRoute();
  const tier = useTier() as TierWithListing;

  const [job, setJob] = React.useState<ListingJobDto | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(1);
  const [agentProfile, setAgentProfile] = React.useState<AgentProfile | null>(tier.agentProfile ?? null);
  const creating = React.useRef(false);

  React.useEffect(() => {
    if (tier.agentProfile) setAgentProfile(tier.agentProfile);
  }, [tier.agentProfile]);

  /* Load or create the draft. */
  const load = React.useCallback(async () => {
    setLoadErr(null);
    try {
      if (jobId) {
        const j = await listingApi.get(jobId);
        setJob(j);
        setStep(Math.min(5, Math.max(1, j.step || 1)));
        return;
      }
      // Deep link (#p=<id> / #r=listing&p=<id>): the Shell parses the hash in
      // an effect that runs AFTER this child effect, so on a full page load
      // the first pass sees jobId=null. Creating here would mint a fresh draft
      // and overwrite the user's `p=` — wait for the Shell to hand it over.
      if (typeof window !== 'undefined') {
        const wanted = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('p');
        if (wanted && wanted.trim()) return;
      }
      if (creating.current) return;
      creating.current = true;
      const j = await listingApi.create({ step: 1 });
      // Never write `p=undefined` into the hash: a blocked/empty create must
      // land on the retry state, not on a draft that does not exist.
      if (!j || typeof j.id !== 'string' || !j.id.trim()) {
        throw new Error('The studio did not return a new listing. Nothing was charged — please try again.');
      }
      setJob(j);
      setStep(1);
      // Rewrite the hash the way Shell.tsx reads it back: #r=listing&p=<id>.
      route.setSelectedProjectId(j.id);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (params.get('p') !== j.id) {
          params.set('r', 'listing');
          params.set('p', j.id);
          window.history.replaceState({ v2: true }, '', `${window.location.pathname}${window.location.search}#${params.toString()}`);
        }
      }
    } catch (e) {
      setLoadErr(listingErrorMessage(e, 'Could not open your listing. Please try again.'));
    } finally {
      creating.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* Autosave. Optimistic merge so the UI never waits on the network. */
  const save = React.useCallback(
    async (patch: ListingJobDraft) => {
      if (!job) return;
      setSaveErr(null);
      setJob((prev) => (prev ? ({ ...prev, ...patch } as ListingJobDto) : prev));
      try {
        const next = await listingApi.patch(job.id, patch);
        setJob((prev) => (prev ? { ...prev, ...next } : next));
      } catch (e) {
        setSaveErr(listingErrorMessage(e, 'Could not save that. Check your connection and try again.'));
        throw e;
      }
    },
    [job],
  );

  const goTo = (n: number) => {
    const clamped = Math.min(5, Math.max(1, n));
    setStep(clamped);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (job && job.step !== clamped) void listingApi.patch(job.id, { step: clamped }).catch(() => {});
  };

  /* Which steps are reachable from the stepper (never skip ahead of the data). */
  const maxReachable = React.useMemo(() => {
    if (!job) return 1;
    if (!(job.sourceImageUrls?.length)) return 1;
    if (!job.address || !job.state) return 2;
    if (!job.sku) return 4; // details are optional; type is required
    return 5;
  }, [job]);

  const licenseVerified = Boolean(tier.capabilities?.license || agentProfile?.licenseStatus === 'verified');

  if (loadErr) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <RetryError message={loadErr} onRetry={() => void load()} variant="banner" />
        <SupportStrip expanded style={{ marginTop: 16 }} />
      </div>
    );
  }
  if (!job) {
    return (
      <div data-testid="listing-wizard-loading" style={{ padding: 40, textAlign: 'center', fontFamily: JELLY_TOKENS.font, fontSize: 18, color: t.textSecondary }}>
        Setting up your listing…
      </div>
    );
  }

  if (job.status !== 'draft') {
    return (
      <ListingProgress
        job={job}
        onJob={setJob}
        licenseVerified={licenseVerified}
        onMakeAnother={() => {
          setJob(null);
          route.setSelectedProjectId(null);
          if (typeof window !== 'undefined') window.location.hash = 'r=listing';
        }}
      />
    );
  }

  return (
    <div data-testid="listing-wizard" data-slot="wizard-step-shell" style={{ maxWidth: 1040, margin: '0 auto', padding: '8px 12px 48px', fontFamily: JELLY_TOKENS.font, fontSize: 18, color: t.text }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <PillStepper
          steps={LISTING_STEPS}
          active={step - 1}
          hints={STEP_HINTS}
          onSelect={(i) => {
            if (i + 1 <= maxReachable) goTo(i + 1);
          }}
        />
        <div style={{ fontSize: 15, color: t.textFaint }}>
          Step {step} of {LISTING_STEPS.length} · autosaved
        </div>
      </div>
      <SupportStrip style={{ marginBottom: 18 }} smsBody={`Listing Studio help — job ${job.id}`} />

      {saveErr && (
        <div style={{ marginBottom: 14 }}>
          <RetryError message={saveErr} variant="banner" />
        </div>
      )}

      <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="26px 24px" shadow>
        {step === 1 && <PhotoStep job={job} onSave={save} onNext={() => goTo(2)} />}
        {step === 2 && <AddressStep job={job} onSave={save} onNext={() => goTo(3)} onBack={() => goTo(1)} />}
        {step === 3 && (
          <DetailsStep
            job={job}
            onSave={save}
            onNext={() => goTo(4)}
            onBack={() => goTo(2)}
            agentProfile={agentProfile}
            onAgentProfileSaved={setAgentProfile}
          />
        )}
        {step === 4 && <TypeStep job={job} onSave={save} onNext={() => goTo(5)} onBack={() => goTo(3)} />}
        {step === 5 && (
          <LookStep
            job={job}
            onSave={save}
            onBack={() => goTo(4)}
            onGoToStep={goTo}
            licenseVerified={licenseVerified}
            onStaged={(next) => {
              setJob(next);
              if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
            }}
          />
        )}
      </GlassCard>
    </div>
  );
}
