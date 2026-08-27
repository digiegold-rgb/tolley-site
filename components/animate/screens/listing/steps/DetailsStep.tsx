'use client';

/**
 * Step 3 — Details. Beds / baths / sqft, feature chips, free-text notes
 * (typed or dictated), a live Fair-Housing lint on everything the agent
 * typed, and the Agent profile card (name, phone, broker, license) the end
 * card is built from. "Verify my license" → POST /api/vater/listing/verify-license.
 *
 * Lint rules come from lib/vater/listing/compliance.ts (the fh_lint.py port).
 * WARN → chip with "Fix it" (applies the rewrite). BLOCK → Next is disabled
 * and the plain-English `why` is shown.
 */
import * as React from 'react';
import type { AgentProfile, AgentProfilePatch, ListingJobDraft, ListingJobDto, VerifyLicenseResponse } from '@/lib/vater/listing/contract';
import { lintFairHousing, applyRewrites, type LintResult, type LintViolation } from '@/lib/vater/listing/compliance';
import { JELLY_TOKENS, glass } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { listingApi, listingErrorMessage } from '../listing-api';
import { useDictation, parseListingFacts } from '../useDictation';
import { Badge, BigButton, Chip, Field, Notice, Select, StepHeader, StepNav, TextArea, TextInput, US_STATES, stateAdRule } from '../listing-ui';

const FEATURE_PRESETS = [
  'Updated kitchen',
  'Hardwood floors',
  'Finished basement',
  'Fenced yard',
  'New roof',
  '2-car garage',
  'Main-floor bedroom',
  'Large lot',
  'Covered porch',
  'Open floor plan',
  'Move-in ready',
  'Fresh paint',
];

type Violation = LintViolation;

export interface DetailsStepProps {
  job: ListingJobDto;
  onSave: (patch: ListingJobDraft) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  /** From useTier() when the /me payload carries it; null → fetched here. */
  agentProfile?: AgentProfile | null;
  onAgentProfileSaved?: (p: AgentProfile | null) => void;
}

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export default function DetailsStep({ job, onSave, onNext, onBack, agentProfile: profileProp, onAgentProfileSaved }: DetailsStepProps): React.ReactElement {
  const { t } = useTheme();
  const [beds, setBeds] = React.useState(job.beds != null ? String(job.beds) : '');
  const [baths, setBaths] = React.useState(job.baths != null ? String(job.baths) : '');
  const [sqft, setSqft] = React.useState(job.sqft != null ? String(job.sqft) : '');
  const [features, setFeatures] = React.useState<string[]>(job.features ?? []);
  const [customFeature, setCustomFeature] = React.useState('');
  const [notes, setNotes] = React.useState(job.dictationRaw ?? '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  /* ── dictation ── */
  const dictation = useDictation({
    onFinal: (chunk) => {
      setNotes((prev) => `${prev ? `${prev} ` : ''}${chunk}`.trim());
    },
  });

  // Every time the notes change, try to lift beds/baths/sqft out of them —
  // only into EMPTY boxes so we never overwrite what the agent typed.
  React.useEffect(() => {
    if (!notes.trim()) return;
    const f = parseListingFacts(notes);
    if (f.beds != null) setBeds((v) => (v ? v : String(f.beds)));
    if (f.baths != null) setBaths((v) => (v ? v : String(f.baths)));
    if (f.sqft != null) setSqft((v) => (v ? v : String(f.sqft)));
  }, [notes]);

  /* ── Fair Housing lint over everything the agent wrote ── */
  const userText = React.useMemo(() => [...features, notes].filter(Boolean).join('\n'), [features, notes]);
  const lint: LintResult = React.useMemo(() => {
    try {
      return lintFairHousing(userText);
    } catch {
      return { ok: true, violations: [] } as unknown as LintResult;
    }
  }, [userText]);
  const blocks = lint.violations.filter((v: Violation) => v.severity === 'BLOCK');
  const warns = lint.violations.filter((v: Violation) => v.severity === 'WARN');

  const fixOne = (v: Violation) => {
    if (v.rewrite == null) return;
    const swap = (s: string) => s.split(v.match).join(v.rewrite as string);
    setNotes((n) => swap(n));
    setFeatures((fs) => fs.map(swap).filter(Boolean));
  };
  const fixAll = () => {
    setNotes((n) => applyRewrites(n));
    setFeatures((fs) => fs.map((f) => applyRewrites(f)).filter(Boolean));
  };
  const removeOne = (v: Violation) => {
    const strip = (s: string) => s.split(v.match).join('').replace(/\s{2,}/g, ' ').trim();
    setNotes((n) => strip(n));
    setFeatures((fs) => fs.map(strip).filter(Boolean));
  };

  /* ── agent profile ── */
  const [profile, setProfile] = React.useState<AgentProfile | null>(profileProp ?? null);
  const [pf, setPf] = React.useState<AgentProfilePatch>({});
  const [pfBusy, setPfBusy] = React.useState(false);
  const [pfMsg, setPfMsg] = React.useState<string | null>(null);
  const [licBusy, setLicBusy] = React.useState(false);
  const [licResult, setLicResult] = React.useState<VerifyLicenseResponse | null>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);

  React.useEffect(() => {
    if (profileProp) {
      setProfile(profileProp);
      return;
    }
    let cancelled = false;
    void listingApi
      .me()
      .then((m) => {
        if (!cancelled) setProfile(m.agentProfile);
      })
      .catch(() => {
        /* profile card still works empty */
      });
    return () => {
      cancelled = true;
    };
  }, [profileProp]);

  React.useEffect(() => {
    setPf({
      agentDisplayName: profile?.agentDisplayName ?? '',
      agentPhone: profile?.agentPhone ?? '',
      brokerName: profile?.brokerName ?? '',
      brokerPhone: profile?.brokerPhone ?? '',
      licenseState: profile?.licenseState ?? (job.state ?? ''),
      licenseNumber: profile?.licenseNumber ?? '',
      narMember: profile?.narMember ?? false,
    });
    // Open the card when the profile is missing the pieces the end card needs.
    setProfileOpen(!(profile?.complete ?? false));
  }, [profile, job.state]);

  const profileComplete = Boolean((pf.agentDisplayName ?? '').trim() && (pf.brokerName ?? '').trim() && (pf.brokerPhone ?? '').trim());

  const saveProfile = async (): Promise<boolean> => {
    setPfBusy(true);
    setPfMsg(null);
    try {
      const saved = await listingApi.saveAgentProfile({
        agentDisplayName: (pf.agentDisplayName ?? '').trim() || null,
        agentPhone: (pf.agentPhone ?? '').trim() || null,
        brokerName: (pf.brokerName ?? '').trim() || null,
        brokerPhone: (pf.brokerPhone ?? '').trim() || null,
        licenseState: (pf.licenseState ?? '').toUpperCase() || null,
        licenseNumber: (pf.licenseNumber ?? '').trim() || null,
        narMember: !!pf.narMember,
      });
      if (saved) {
        setProfile(saved);
        onAgentProfileSaved?.(saved);
      }
      setPfMsg('Saved.');
      return true;
    } catch (e) {
      setPfMsg(listingErrorMessage(e, 'Could not save your profile. Please try again.'));
      return false;
    } finally {
      setPfBusy(false);
    }
  };

  const verifyLicense = async () => {
    const state = (pf.licenseState ?? '').toUpperCase();
    const licenseNumber = (pf.licenseNumber ?? '').trim();
    if (!state || !licenseNumber) {
      setPfMsg('Enter your license state and number first.');
      return;
    }
    setLicBusy(true);
    setPfMsg(null);
    try {
      await saveProfile();
      const r = await listingApi.verifyLicense({ state, licenseNumber });
      setLicResult(r);
      if (r.licenseeName || r.status) {
        setProfile((p) => (p ? { ...p, licenseStatus: r.status, licenseeName: r.licenseeName ?? p.licenseeName } : p));
      }
    } catch (e) {
      setPfMsg(listingErrorMessage(e, 'Could not check the license right now. You can keep going — MLS-safe export unlocks once it is verified.'));
    } finally {
      setLicBusy(false);
    }
  };

  const licenseStatus = licResult?.status ?? profile?.licenseStatus ?? 'unverified';

  /* ── next ── */
  const next = async () => {
    setErr(null);
    if (blocks.length) {
      setErr('Fix the wording flagged in red first — it cannot go in a listing ad.');
      return;
    }
    setBusy(true);
    try {
      if (profileOpen && profileComplete) await saveProfile();
      await onSave({
        beds: numOrNull(beds),
        baths: numOrNull(baths),
        sqft: numOrNull(sqft),
        features,
        dictationRaw: notes.trim() || null,
        step: 3,
      });
      onNext();
    } catch (e) {
      setErr(listingErrorMessage(e, 'Could not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleFeature = (f: string) => setFeatures((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]));
  const addCustom = () => {
    const v = customFeature.trim();
    if (!v) return;
    if (!features.includes(v)) setFeatures((fs) => [...fs, v]);
    setCustomFeature('');
  };

  const card: React.CSSProperties = { ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, padding: 20, display: 'grid', gap: 14 };

  return (
    <div data-testid="listing-step-3">
      <StepHeader step={3} title="A few details about the home" lede="These go in the caption and on the tour. Skip anything you don’t know." />

      <div style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
        {/* facts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(90px, 1fr))', gap: 12 }}>
          <Field label="Beds"><TextInput data-testid="listing-beds" value={beds} onChange={(e) => setBeds(e.target.value)} inputMode="decimal" placeholder="3" /></Field>
          <Field label="Baths"><TextInput data-testid="listing-baths" value={baths} onChange={(e) => setBaths(e.target.value)} inputMode="decimal" placeholder="2" /></Field>
          <Field label="Sq ft"><TextInput data-testid="listing-sqft" value={sqft} onChange={(e) => setSqft(e.target.value)} inputMode="numeric" placeholder="1,800" /></Field>
        </div>

        {/* features */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 8 }}>Tap the features that apply</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FEATURE_PRESETS.map((f) => (
              <Chip key={f} on={features.includes(f)} onClick={() => toggleFeature(f)} testId={`listing-feature-${f.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                {f}
              </Chip>
            ))}
            {features.filter((f) => !FEATURE_PRESETS.includes(f)).map((f) => (
              <Chip key={f} on onClick={() => toggleFeature(f)} title="Tap to remove">
                {f} ✕
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 480 }}>
            <TextInput
              value={customFeature}
              onChange={(e) => setCustomFeature(e.target.value)}
              placeholder="Add your own (e.g. new furnace 2024)"
              aria-label="Add a feature"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <BigButton variant="ghost" onClick={addCustom} style={{ minHeight: 54, padding: '0 20px' }}>Add</BigButton>
          </div>
        </div>

        {/* notes + dictation */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Describe the home in your own words</div>
            {dictation.supported ? (
              <BigButton
                variant={dictation.listening ? 'danger' : 'outline'}
                onClick={dictation.listening ? dictation.stop : dictation.start}
                data-testid="listing-dictate"
                aria-label={dictation.listening ? 'Stop the microphone' : 'Speak instead of typing'}
                style={{ minHeight: 48, padding: '10px 18px', fontSize: 16 }}
              >
                {dictation.listening ? '■ Stop' : '🎤 Speak it'}
              </BigButton>
            ) : (
              <span style={{ fontSize: 14, color: t.textFaint }}>Voice typing is not available in this browser — typing works the same.</span>
            )}
          </div>
          <TextArea
            data-testid="listing-notes"
            value={dictation.listening && dictation.interim ? `${notes}${notes ? ' ' : ''}${dictation.interim}` : notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Three bed, two bath ranch, about 1,800 square feet. Updated kitchen, fenced yard, close to the park…"
          />
          {dictation.listening && (
            <div style={{ fontSize: 15, color: JELLY_TOKENS.cyan }} aria-live="polite">
              ● Listening… say beds, baths and square feet and we fill the boxes above.
            </div>
          )}
          {dictation.error && <Notice tone="warn">{dictation.error}</Notice>}

          {/* Fair Housing lint */}
          {(warns.length > 0 || blocks.length > 0) && (
            <div style={{ display: 'grid', gap: 8 }} data-testid="listing-fh-lint">
              {blocks.map((v: Violation, i: number) => (
                <Notice key={`b${i}`} tone="block" testId="listing-fh-block">
                  <div style={{ fontWeight: 700 }}>“{v.match}” can’t go in a listing ad.</div>
                  <div style={{ fontSize: 15, color: t.textSecondary, marginTop: 2 }}>{v.why}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {v.rewrite && <Chip tone="block" onClick={() => fixOne(v)} testId="listing-fh-fix">Use “{v.rewrite}”</Chip>}
                    <Chip tone="block" onClick={() => removeOne(v)}>Remove it</Chip>
                  </div>
                </Notice>
              ))}
              {warns.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {warns.map((v: Violation, i: number) => (
                    <Chip key={`w${i}`} tone="warn" onClick={() => (v.rewrite ? fixOne(v) : removeOne(v))} title={v.why} testId="listing-fh-warning">
                      ⚠ “{v.match}” → {v.rewrite ? `“${v.rewrite}”` : 'remove'} · Fix it
                    </Chip>
                  ))}
                  {warns.some((v: Violation) => v.rewrite) && (
                    <Chip tone="warn" onClick={fixAll} testId="listing-fh-fix-all">Fix all</Chip>
                  )}
                </div>
              )}
              {warns.length > 0 && blocks.length === 0 && (
                <div style={{ fontSize: 15, color: t.textSecondary }}>Fair Housing: these words are risky in a housing ad. Tap one to swap in safer wording — hover to see why.</div>
              )}
            </div>
          )}
          {userText.trim() && lint.ok && warns.length === 0 && (
            <div style={{ fontSize: 15, color: JELLY_TOKENS.success }} data-testid="listing-fh-ok">✓ Fair-Housing check: clean</div>
          )}
        </div>

        {/* agent profile */}
        <div style={card} data-testid="listing-agent-profile">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>Agent profile</div>
              <div style={{ fontSize: 15, color: t.textSecondary, marginTop: 2 }}>Goes on the end card of every video. {stateAdRule(pf.licenseState || job.state).headline}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {profileComplete ? <Badge tone="ok">Complete</Badge> : <Badge tone="warn">Needed before you pay</Badge>}
              {licenseStatus === 'verified' ? <Badge tone="ok">License verified</Badge> : licenseStatus === 'manual_review' ? <Badge tone="brand">License under review</Badge> : licenseStatus === 'invalid' ? <Badge tone="warn">License not found</Badge> : <Badge tone="faint">License unverified</Badge>}
              <BigButton variant="ghost" onClick={() => setProfileOpen((o) => !o)} style={{ minHeight: 44, padding: '8px 16px', fontSize: 16 }} data-testid="listing-profile-toggle">
                {profileOpen ? 'Hide' : 'Edit'}
              </BigButton>
            </div>
          </div>

          {profileOpen && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <Field label="Your name (as licensed)"><TextInput data-testid="listing-profile-name" value={pf.agentDisplayName ?? ''} onChange={(e) => setPf({ ...pf, agentDisplayName: e.target.value })} autoComplete="name" /></Field>
                <Field label="Your phone"><TextInput data-testid="listing-profile-phone" value={pf.agentPhone ?? ''} onChange={(e) => setPf({ ...pf, agentPhone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="(816) 555-0100" /></Field>
                <Field label="Broker name (licensed business name)"><TextInput data-testid="listing-profile-broker" value={pf.brokerName ?? ''} onChange={(e) => setPf({ ...pf, brokerName: e.target.value })} autoComplete="organization" /></Field>
                <Field label="Broker phone"><TextInput data-testid="listing-profile-broker-phone" value={pf.brokerPhone ?? ''} onChange={(e) => setPf({ ...pf, brokerPhone: e.target.value })} inputMode="tel" placeholder="(816) 555-0100" /></Field>
                <Field label="License state">
                  <Select data-testid="listing-profile-license-state" value={(pf.licenseState ?? '').toUpperCase()} onChange={(e) => setPf({ ...pf, licenseState: e.target.value })}>
                    <option value="">Pick…</option>
                    {US_STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
                  </Select>
                </Field>
                <Field label="License number" hint="Missouri licenses are checked live; other states are reviewed by a person within a day.">
                  <TextInput data-testid="listing-profile-license-number" value={pf.licenseNumber ?? ''} onChange={(e) => setPf({ ...pf, licenseNumber: e.target.value })} />
                </Field>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, color: t.text }}>
                <input type="checkbox" data-testid="listing-profile-nar" checked={!!pf.narMember} onChange={(e) => setPf({ ...pf, narMember: e.target.checked })} style={{ width: 22, height: 22 }} />
                I am a member of the National Association of REALTORS® (adds “REALTOR®” after your name once your license is verified)
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <BigButton variant="outline" onClick={() => void saveProfile()} busy={pfBusy} data-testid="listing-profile-save" style={{ minHeight: 48, padding: '10px 20px', fontSize: 16 }}>Save profile</BigButton>
                <BigButton variant="ghost" onClick={() => void verifyLicense()} busy={licBusy} data-testid="listing-verify-license" style={{ minHeight: 48, padding: '10px 20px', fontSize: 16 }}>Verify my license</BigButton>
                {pfMsg && <span style={{ fontSize: 15, color: pfMsg === 'Saved.' ? JELLY_TOKENS.success : JELLY_TOKENS.warning }}>{pfMsg}</span>}
              </div>
              {licResult && (
                <Notice tone={licResult.status === 'verified' ? 'ok' : licResult.status === 'invalid' ? 'warn' : 'info'} testId="listing-license-result">
                  {licResult.status === 'verified' && <>✓ Verified{licResult.licenseeName ? ` — ${licResult.licenseeName}` : ''}. MLS-safe export is unlocked.</>}
                  {licResult.status === 'manual_review' && <>Thanks — a person will confirm this within a day. You can keep going; MLS-safe export unlocks when it’s confirmed.</>}
                  {licResult.status === 'invalid' && <>We couldn’t find that license{licResult.reason ? ` (${licResult.reason})` : ''}. Check the number, or text us and we’ll sort it.</>}
                </Notice>
              )}
              <div style={{ fontSize: 14, color: t.textFaint }}>Why we ask: your state’s advertising rule puts your broker’s name (and phone) on every ad. Missing broker phone = we can’t export.</div>
            </div>
          )}
        </div>

        {err && <Notice tone="block" testId="listing-details-error">{err}</Notice>}
      </div>

      <StepNav
        onBack={onBack}
        next={
          <BigButton onClick={() => void next()} busy={busy} disabled={blocks.length > 0} data-testid="listing-next" title={blocks.length ? 'Fix the red wording first' : undefined}>
            Next: pick the video →
          </BigButton>
        }
      />
    </div>
  );
}
