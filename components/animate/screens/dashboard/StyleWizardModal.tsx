'use client';

/**
 * StyleWizardModal — Create-Style wizard, modal-in-modal launched from
 * StylePickerModal. Mirrors TubeGen's create-style layout: required fields
 * always visible, four collapsible advanced sections, blocked save until
 * the bare minimum is filled (name + word count + voice + ≥1 reference).
 *
 * Save flow (3 calls, ordered):
 *   1. POST /api/vater/youtube/styles { name }                  → creates empty style
 *   2. PATCH /api/vater/youtube/styles/[id] { ...fields }       → applies all settings
 *   3. POST  /api/vater/youtube/styles/[id]/references { urls } → kicks DGX transcribe
 *
 * Steps 1+2 are awaited; step 3 is best-effort (the DGX side runs async and
 * the callback writes referenceTranscripts later). We surface step-3 errors
 * via alert() so the user can retry from the gallery if it fails.
 *
 * No silent catches. Inline styles only. PATCHABLE_FIELDS list lives in
 * /app/api/vater/youtube/styles/[id]/route.ts — kept in sync below.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { devError } from '../../log';
import { VBtn } from '../../primitives';

/* ─── Types ─── */

export interface CreatedStyle {
  id: string;
  name: string;
  emoji?: string | null;
  voice?: string | null;
  referenceTranscripts?: unknown;
}

interface VaterVoice {
  name: string;
  language?: string;
}

interface ElevenVoice {
  voice_id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (style: CreatedStyle) => void;
}

/* Match the autopilot/Prisma defaults — keep in sync with schema. */
const SCRIPT_MODES = [
  { value: 'default', label: 'TubeWriter V1 (default)' },
  { value: 'few_shot', label: 'TubeWriter V2 (few-shot)' },
  { value: 'pro', label: 'TubeWriter Pro' },
  { value: 'story', label: 'Story mode' },
] as const;

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
] as const;

const VISUAL_TYPES = [
  { value: 'images', label: 'Images' },
  { value: 'animated', label: 'Animated' },
  { value: 'avatar', label: 'Avatar' },
  { value: 'broll', label: 'B-Roll' },
  { value: 'broll-mix', label: 'B-Roll Mix' },
] as const;

const ASPECT_RATIOS = [
  { value: '16x9', label: '16:9 — landscape' },
  { value: '9x16', label: '9:16 — vertical / Shorts' },
  { value: '1x1', label: '1:1 — square' },
  { value: '4x5', label: '4:5 — portrait' },
] as const;

const QUALITY_OPTIONS = [
  { value: 'firered-local', label: 'FireRed Local (DGX, default)' },
  { value: 'gemini-1k', label: 'Gemini 1K (cloud)' },
  { value: 'gemini-2k', label: 'Gemini 2K (cloud)' },
  { value: 'sdxl-local', label: 'SDXL Local' },
  { value: 'flux-schnell', label: 'FLUX Schnell' },
] as const;

const OVERLAY_THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'brand', label: 'Brand purple' },
] as const;

/* ─── Component ─── */

export function StyleWizardModal({
  open,
  onClose,
  onCreated,
}: Props): React.ReactElement | null {
  const { t } = useTheme();

  // ── Required fields ──
  const [name, setName] = React.useState('');
  const [defaultWordCount, setDefaultWordCount] = React.useState(500);
  const [language, setLanguage] = React.useState<string>('en');
  const [voiceBackend, setVoiceBackend] = React.useState<'f5-tts' | 'elevenlabs'>(
    'f5-tts',
  );
  const [voice, setVoice] = React.useState<string>('');
  const [referenceUrls, setReferenceUrls] = React.useState<string[]>(['']);

  // ── Voice catalog ──
  const [vaterVoices, setVaterVoices] = React.useState<VaterVoice[]>([]);
  const [elevenVoices, setElevenVoices] = React.useState<ElevenVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = React.useState(false);
  const [voicesError, setVoicesError] = React.useState<string | null>(null);

  // ── Collapsibles ──
  const [openScript, setOpenScript] = React.useState(false);
  const [openVoice, setOpenVoice] = React.useState(false);
  const [openVisuals, setOpenVisuals] = React.useState(false);
  const [openOverlays, setOpenOverlays] = React.useState(false);

  // ── Script Controls ──
  const [scriptMode, setScriptMode] = React.useState<string>('default');
  const [webSearchDefault, setWebSearchDefault] = React.useState(false);
  const [scriptAdditionalContext, setScriptAdditionalContext] = React.useState('');

  // ── Voice Controls (sliders 0-1 in DB; UI shows %) ──
  const [voiceSpeedPct, setVoiceSpeedPct] = React.useState(100); // 80-120
  const [voiceSimilarityPct, setVoiceSimilarityPct] = React.useState(100); // 0-100
  const [voiceStabilityPct, setVoiceStabilityPct] = React.useState(100); // 0-100
  const [voiceExaggerationPct, setVoiceExaggerationPct] = React.useState(0); // 0-100

  // ── Visual Defaults ──
  const [defaultVisualType, setDefaultVisualType] = React.useState('images');
  const [artStyleLabel] = React.useState('Realistic'); // v1 placeholder
  const [defaultAspectRatio, setDefaultAspectRatio] = React.useState('16x9');
  const [defaultQuality, setDefaultQuality] = React.useState('firered-local');
  const [visualAdditionalContext, setVisualAdditionalContext] = React.useState('');

  // ── Smart Overlay Defaults ──
  const [enableCharts, setEnableCharts] = React.useState(false);
  const [enableMaps, setEnableMaps] = React.useState(false);
  const [enableAutoHeaders, setEnableAutoHeaders] = React.useState(false);
  const [overlayTheme, setOverlayTheme] = React.useState('dark');

  // ── Save state ──
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Load voice catalog on open.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setVoicesLoading(true);
    setVoicesError(null);
    (async () => {
      try {
        const [vRes, eRes] = await Promise.all([
          fetch('/api/vater/voices', { cache: 'no-store' }),
          fetch('/api/vater/voices/elevenlabs', { cache: 'no-store' }),
        ]);
        if (!vRes.ok) {
          throw new Error(`Voice clones HTTP ${vRes.status}`);
        }
        const vData = (await vRes.json()) as { voices?: VaterVoice[] };
        if (cancelled) return;
        setVaterVoices(Array.isArray(vData.voices) ? vData.voices : []);
        if (eRes.ok) {
          const eData = (await eRes.json()) as { voices?: ElevenVoice[] };
          if (!cancelled) {
            setElevenVoices(Array.isArray(eData.voices) ? eData.voices : []);
          }
        } else {
          // Soft-fail — UI just shows F5 picker only.
          if (!cancelled) setElevenVoices([]);
        }
      } catch (err) {
        if (cancelled) return;
        devError('[StyleWizardModal] voices load failed:', err);
        setVoicesError(
          err instanceof Error ? err.message : 'Failed to load voices',
        );
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset all state when modal closes (so re-opening starts fresh).
  React.useEffect(() => {
    if (open) return;
    setName('');
    setDefaultWordCount(500);
    setLanguage('en');
    setVoiceBackend('f5-tts');
    setVoice('');
    setReferenceUrls(['']);
    setOpenScript(false);
    setOpenVoice(false);
    setOpenVisuals(false);
    setOpenOverlays(false);
    setScriptMode('default');
    setWebSearchDefault(false);
    setScriptAdditionalContext('');
    setVoiceSpeedPct(100);
    setVoiceSimilarityPct(100);
    setVoiceStabilityPct(100);
    setVoiceExaggerationPct(0);
    setDefaultVisualType('images');
    setDefaultAspectRatio('16x9');
    setDefaultQuality('firered-local');
    setVisualAdditionalContext('');
    setEnableCharts(false);
    setEnableMaps(false);
    setEnableAutoHeaders(false);
    setOverlayTheme('dark');
    setSaving(false);
    setSaveError(null);
  }, [open]);

  // Esc closes (when not saving).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  // ── Derived ──
  const validReferenceUrls = referenceUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  const canSave =
    !saving &&
    name.trim().length > 0 &&
    Number.isFinite(defaultWordCount) &&
    defaultWordCount >= 200 &&
    defaultWordCount <= 3000 &&
    voice.trim().length > 0 &&
    validReferenceUrls.length >= 1;

  const refsWarning = validReferenceUrls.length > 0 && validReferenceUrls.length < 3;

  // ── Handlers ──
  const updateRef = (i: number, val: string) => {
    setReferenceUrls((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };

  const addRef = () => setReferenceUrls((prev) => [...prev, '']);
  const removeRef = (i: number) =>
    setReferenceUrls((prev) =>
      prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i),
    );

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      // 1. Create empty style
      const createRes = await fetch('/api/vater/youtube/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!createRes.ok) {
        const data = (await createRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `Create HTTP ${createRes.status}`);
      }
      const createData = (await createRes.json()) as {
        style?: { id?: string };
      };
      const styleId = createData?.style?.id;
      if (!styleId) throw new Error('Create returned no style id');

      // 2. PATCH all settable fields. Sliders are stored as 0..1 float in DB
      //    (we just multiply percent by 0.01). voiceSpeed accepts 0.8..1.2
      //    range — we map 80-120% → 0.8-1.2.
      const patchBody = {
        defaultWordCount,
        language,
        voice: voice.trim(),
        voiceBackend,
        voiceSpeed: Math.max(0.8, Math.min(1.2, voiceSpeedPct / 100)),
        voiceSimilarity: Math.max(0, Math.min(1, voiceSimilarityPct / 100)),
        voiceStability: Math.max(0, Math.min(1, voiceStabilityPct / 100)),
        voiceExaggeration: Math.max(0, Math.min(1, voiceExaggerationPct / 100)),
        scriptMode,
        webSearchDefault,
        additionalContext: scriptAdditionalContext.trim() || null,
        defaultVisualType,
        defaultAspectRatio,
        defaultQuality,
        enableCharts,
        enableMaps,
        enableAutoHeaders,
        overlayTheme,
      };

      const patchRes = await fetch(
        `/api/vater/youtube/styles/${encodeURIComponent(styleId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        },
      );
      if (!patchRes.ok) {
        const data = (await patchRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `PATCH HTTP ${patchRes.status}`);
      }
      const patchData = (await patchRes.json()) as {
        style?: CreatedStyle;
      };

      // 3. Kick off reference transcribe (best-effort — surfaces alert on
      //    failure but doesn't roll back the style).
      try {
        const refRes = await fetch(
          `/api/vater/youtube/styles/${encodeURIComponent(
            styleId,
          )}/references`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: validReferenceUrls.slice(0, 6) }),
          },
        );
        if (!refRes.ok) {
          const data = (await refRes.json().catch(() => ({}))) as {
            error?: string;
          };
          devError(
            '[StyleWizardModal] references kickoff failed:',
            data.error,
          );
          alert(
            `Style created, but reference transcribe didn't kick off: ${
              data.error || `HTTP ${refRes.status}`
            }. You can retry from the Styles page.`,
          );
        }
      } catch (refErr) {
        devError('[StyleWizardModal] references kickoff error:', refErr);
        alert(
          'Style created, but reference transcribe call failed (network). Retry from the Styles page.',
        );
      }

      // We optimistically pass a reference list reflecting the URLs the user
      // entered — actual transcripts populate async via the references
      // callback. The picker list refresh on next open will show real counts.
      onCreated({
        id: styleId,
        name: patchData?.style?.name ?? name.trim(),
        emoji: patchData?.style?.emoji ?? null,
        voice: patchData?.style?.voice ?? voice.trim(),
        referenceTranscripts: validReferenceUrls.map((url) => ({ url })),
      });
    } catch (err) {
      devError('[StyleWizardModal] save failed:', err);
      const msg =
        err instanceof Error ? err.message : 'Failed to create style';
      setSaveError(msg);
      alert(`Could not create style: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ──
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: t.textSecondary,
    marginBottom: 6,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 14,
    fontFamily: JELLY_TOKENS.font,
    border: `1px solid ${t.border}`,
    borderRadius: JELLY_TOKENS.radius.md,
    background: t.card,
    color: t.text,
    padding: '10px 12px',
    boxSizing: 'border-box',
    outline: 'none',
  };
  const sectionStyle: React.CSSProperties = {
    border: `1px solid ${t.border}`,
    borderRadius: JELLY_TOKENS.radius.md,
    background: t.cardAlt,
    overflow: 'hidden',
  };
  const sectionHeaderStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    color: t.text,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: JELLY_TOKENS.font,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  };
  const sectionBodyStyle: React.CSSProperties = {
    padding: 14,
    borderTop: `1px solid ${t.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: t.card,
  };

  const slider = (
    label: string,
    value: number,
    setValue: (n: number) => void,
    min: number,
    max: number,
    suffix: string,
  ) => (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={labelStyle}>{label}</span>
        <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: JELLY_TOKENS.brand }}
      />
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create new style"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '92vh',
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: JELLY_TOKENS.radius.lg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            Create New Style
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <VBtn
              size="sm"
              variant="ghost"
              onClick={() => {
                /* tutorial placeholder — Phase 1 ships without */
              }}
              icon="play"
            >
              Watch Tutorial
            </VBtn>
            <button
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: t.textSecondary,
                cursor: saving ? 'not-allowed' : 'pointer',
                padding: 4,
                opacity: saving ? 0.4 : 1,
              }}
            >
              <Icon name="close" size={20} color={t.textSecondary} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {saveError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${JELLY_TOKENS.error}`,
                background: 'rgba(220,38,38,0.08)',
                color: JELLY_TOKENS.error,
                fontSize: 13,
              }}
            >
              {saveError}
            </div>
          )}

          {/* Required fields */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div>
              <label style={labelStyle}>Style Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cinematic Documentary"
                maxLength={120}
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Default Word Count *</label>
                <input
                  type="number"
                  min={200}
                  max={3000}
                  step={50}
                  value={defaultWordCount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setDefaultWordCount(Number.isFinite(n) ? n : 500);
                  }}
                  style={inputStyle}
                />
                <div
                  style={{
                    fontSize: 11,
                    color: t.textSecondary,
                    marginTop: 4,
                  }}
                >
                  Range 200–3000. Roughly 150 words ≈ 1 minute.
                </div>
              </div>

              <div>
                <label style={labelStyle}>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={inputStyle}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Voice *</label>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 6,
                  flexWrap: 'wrap',
                }}
              >
                {(['f5-tts', 'elevenlabs'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setVoiceBackend(b);
                      setVoice('');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: JELLY_TOKENS.radius.pill,
                      border: `1px solid ${
                        voiceBackend === b
                          ? JELLY_TOKENS.brand
                          : t.border
                      }`,
                      background:
                        voiceBackend === b
                          ? JELLY_TOKENS.brandGhost
                          : 'transparent',
                      color:
                        voiceBackend === b
                          ? JELLY_TOKENS.brand
                          : t.textSecondary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: JELLY_TOKENS.font,
                    }}
                  >
                    {b === 'f5-tts' ? 'Voice Clones (F5)' : 'ElevenLabs'}
                  </button>
                ))}
              </div>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={voicesLoading}
                style={inputStyle}
              >
                <option value="">
                  {voicesLoading ? 'Loading voices…' : 'Pick a voice…'}
                </option>
                {voiceBackend === 'f5-tts'
                  ? vaterVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name}
                        {v.language ? ` — ${v.language}` : ''}
                      </option>
                    ))
                  : elevenVoices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}
                      </option>
                    ))}
              </select>
              {voicesError && (
                <div
                  style={{
                    fontSize: 12,
                    color: JELLY_TOKENS.error,
                    marginTop: 4,
                  }}
                >
                  {voicesError}
                </div>
              )}
              {!voicesLoading &&
                voiceBackend === 'elevenlabs' &&
                elevenVoices.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: t.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    No ElevenLabs voices available — set
                    ELEVENLABS_API_KEY on autopilot or use F5 clones.
                  </div>
                )}
            </div>

            <div>
              <label style={labelStyle}>
                Reference Videos *{' '}
                <span style={{ color: t.textSecondary, fontWeight: 400 }}>
                  (paste YouTube URLs — at least 1)
                </span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {referenceUrls.map((url, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                  >
                    <input
                      value={url}
                      onChange={(e) => updateRef(i, e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRef(i)}
                      aria-label="Remove reference"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${t.border}`,
                        borderRadius: JELLY_TOKENS.radius.md,
                        color: t.textSecondary,
                        padding: '8px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name="close" size={14} color={t.textSecondary} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRef}
                  disabled={referenceUrls.length >= 6}
                  style={{
                    alignSelf: 'flex-start',
                    background: JELLY_TOKENS.brandGhost,
                    border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    color: JELLY_TOKENS.brand,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor:
                      referenceUrls.length >= 6 ? 'not-allowed' : 'pointer',
                    opacity: referenceUrls.length >= 6 ? 0.5 : 1,
                    fontFamily: JELLY_TOKENS.font,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="plus" size={14} color={JELLY_TOKENS.brand} />
                  Add reference
                </button>
              </div>
              {refsWarning && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: 'rgba(245,158,11,0.12)',
                    border: `1px solid rgba(245,158,11,0.45)`,
                    color: JELLY_TOKENS.warning,
                    fontSize: 12,
                  }}
                >
                  Tip: 3+ reference videos give the script tone a much
                  stronger anchor.
                </div>
              )}
            </div>
          </div>

          {/* ── Collapsible 1: Script Controls ── */}
          <div style={sectionStyle}>
            <button
              type="button"
              style={sectionHeaderStyle}
              onClick={() => setOpenScript((v) => !v)}
            >
              <span>Script Controls</span>
              <Icon
                name={openScript ? 'chevronDown' : 'chevronRight'}
                size={16}
                color={t.textSecondary}
              />
            </button>
            {openScript && (
              <div style={sectionBodyStyle}>
                <div>
                  <label style={labelStyle}>Script Writing Mode</label>
                  <select
                    value={scriptMode}
                    onChange={(e) => setScriptMode(e.target.value)}
                    style={inputStyle}
                  >
                    {SCRIPT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: t.text,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={webSearchDefault}
                    onChange={(e) => setWebSearchDefault(e.target.checked)}
                    style={{ accentColor: JELLY_TOKENS.brand }}
                  />
                  Enable web search by default
                </label>

                <div>
                  <label style={labelStyle}>Additional Context</label>
                  <textarea
                    rows={3}
                    value={scriptAdditionalContext}
                    onChange={(e) =>
                      setScriptAdditionalContext(e.target.value)
                    }
                    placeholder="Anything the script writer should always remember about this channel."
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Collapsible 2: Voice Controls ── */}
          <div style={sectionStyle}>
            <button
              type="button"
              style={sectionHeaderStyle}
              onClick={() => setOpenVoice((v) => !v)}
            >
              <span>Voice Controls</span>
              <Icon
                name={openVoice ? 'chevronDown' : 'chevronRight'}
                size={16}
                color={t.textSecondary}
              />
            </button>
            {openVoice && (
              <div style={sectionBodyStyle}>
                {slider(
                  'Speed',
                  voiceSpeedPct,
                  setVoiceSpeedPct,
                  80,
                  120,
                  '%',
                )}
                {slider(
                  'Similarity',
                  voiceSimilarityPct,
                  setVoiceSimilarityPct,
                  0,
                  100,
                  '%',
                )}
                {slider(
                  'Stability',
                  voiceStabilityPct,
                  setVoiceStabilityPct,
                  0,
                  100,
                  '%',
                )}
                {slider(
                  'Exaggeration',
                  voiceExaggerationPct,
                  setVoiceExaggerationPct,
                  0,
                  100,
                  '%',
                )}
              </div>
            )}
          </div>

          {/* ── Collapsible 3: Visual Defaults ── */}
          <div style={sectionStyle}>
            <button
              type="button"
              style={sectionHeaderStyle}
              onClick={() => setOpenVisuals((v) => !v)}
            >
              <span>Visual Defaults</span>
              <Icon
                name={openVisuals ? 'chevronDown' : 'chevronRight'}
                size={16}
                color={t.textSecondary}
              />
            </button>
            {openVisuals && (
              <div style={sectionBodyStyle}>
                <div>
                  <label style={labelStyle}>Default Visual Type</label>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    {VISUAL_TYPES.map((vt) => (
                      <label
                        key={vt.value}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: JELLY_TOKENS.radius.pill,
                          border: `1px solid ${
                            defaultVisualType === vt.value
                              ? JELLY_TOKENS.brand
                              : t.border
                          }`,
                          background:
                            defaultVisualType === vt.value
                              ? JELLY_TOKENS.brandGhost
                              : 'transparent',
                          color:
                            defaultVisualType === vt.value
                              ? JELLY_TOKENS.brand
                              : t.text,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="visualType"
                          value={vt.value}
                          checked={defaultVisualType === vt.value}
                          onChange={() => setDefaultVisualType(vt.value)}
                          style={{
                            accentColor: JELLY_TOKENS.brand,
                            margin: 0,
                          }}
                        />
                        {vt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Default Image Style</label>
                  <button
                    type="button"
                    onClick={() => {
                      // v1: simple notice. The art-style picker is shipped
                      // separately — clicking this in v2 will open it once
                      // we plumb /styles/art-style.
                      alert(
                        'Art-style preset picker ships in a follow-up. Default is "Realistic" for now.',
                      );
                    }}
                    style={{
                      ...inputStyle,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ color: t.text }}>{artStyleLabel}</span>
                    <Icon
                      name="chevronRight"
                      size={14}
                      color={t.textSecondary}
                    />
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Aspect Ratio</label>
                    <select
                      value={defaultAspectRatio}
                      onChange={(e) =>
                        setDefaultAspectRatio(e.target.value)
                      }
                      style={inputStyle}
                    >
                      {ASPECT_RATIOS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Quality</label>
                    <select
                      value={defaultQuality}
                      onChange={(e) => setDefaultQuality(e.target.value)}
                      style={inputStyle}
                    >
                      {QUALITY_OPTIONS.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Additional Context</label>
                  <textarea
                    rows={2}
                    value={visualAdditionalContext}
                    onChange={(e) =>
                      setVisualAdditionalContext(e.target.value)
                    }
                    placeholder="Visual cues the renderer should always honor (palette, era, etc.)"
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: t.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    Note: visual additional context is captured locally for
                    now — wired to the renderer in a follow-up.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Collapsible 4: Smart Overlay Defaults ── */}
          <div style={sectionStyle}>
            <button
              type="button"
              style={sectionHeaderStyle}
              onClick={() => setOpenOverlays((v) => !v)}
            >
              <span>Smart Overlay Defaults</span>
              <Icon
                name={openOverlays ? 'chevronDown' : 'chevronRight'}
                size={16}
                color={t.textSecondary}
              />
            </button>
            {openOverlays && (
              <div style={sectionBodyStyle}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: t.text,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enableCharts}
                    onChange={(e) => setEnableCharts(e.target.checked)}
                    style={{ accentColor: JELLY_TOKENS.brand }}
                  />
                  Auto Charts
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: t.text,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enableMaps}
                    onChange={(e) => setEnableMaps(e.target.checked)}
                    style={{ accentColor: JELLY_TOKENS.brand }}
                  />
                  Auto Maps
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: t.text,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enableAutoHeaders}
                    onChange={(e) => setEnableAutoHeaders(e.target.checked)}
                    style={{ accentColor: JELLY_TOKENS.brand }}
                  />
                  Auto Headers
                </label>
                <div>
                  <label style={labelStyle}>Overlay Theme</label>
                  <select
                    value={overlayTheme}
                    onChange={(e) => setOverlayTheme(e.target.value)}
                    style={inputStyle}
                  >
                    {OVERLAY_THEMES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: t.cardAlt,
          }}
        >
          <div style={{ fontSize: 11, color: t.textSecondary }}>
            {saving
              ? 'Creating style…'
              : canSave
                ? 'Ready to save.'
                : 'Need name, word count, voice, and ≥1 reference video.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <VBtn size="sm" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </VBtn>
            <VBtn size="sm" onClick={handleSave} disabled={!canSave}>
              {saving ? 'Saving…' : 'Create Style'}
            </VBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
