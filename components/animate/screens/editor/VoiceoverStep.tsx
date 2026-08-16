'use client';

/* VoiceoverStep — Step 3.
 *
 * Wraps:
 *   - YouTubeVoiceClonePanel mode="select" for voice settings (default = local
 *     F5-TTS clone, ElevenLabs is opt-in via the wrapped panel's audition
 *     pathway). Honors feedback_local_tts_preference.md.
 *   - YouTubePopularVoices for ElevenLabs preview-only auditioning (NOT wired
 *     to project payload — preserves existing behavior).
 *
 * Adds:
 *   - Show Script collapse (read-only preview from project.script)
 *   - Audio player for project.audioUrl (proxies through DGX). Native <audio>
 *     element so Range header forwarding stays intact (risk #10).
 *   - Cut Silences segmented (Smooth / Natural / Jumpy). Local state only —
 *     the pipeline doesn't yet accept this knob; we surface it for parity and
 *     PATCH onto a future field when the backend lands it.
 *
 * Voice sample preview URLs — when YouTubePopularVoices builds them, it goes
 * via /api/vater/elevenlabs/popular-voices which already handles encoding.
 * Voice clone sample URLs internal to YouTubeVoiceClonePanel use
 * encodeURIComponent(name) — risk #11 already handled inside the wrapped
 * component (line 27).
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, VCard, VInput, SectionHeader, Toast } from '../../primitives';
import { YouTubeVoiceClonePanel } from '@/components/vater/youtube-voice-clone-panel';
import { YouTubePopularVoices } from '@/components/vater/youtube-popular-voices';
import { upload } from '@vercel/blob/client';
import {
  readFeatures,
  saveFeatures,
  FEATURE_LANGUAGES,
  type FeatureLanguage,
} from '@/lib/vater/project-features';
import {
  featureFetch,
  FeatureUnavailableError,
  COMING_ONLINE,
} from './feature-fetch';
import type { EditorStepProps } from './ProjectShell';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockReason,
} from './BillingBlock';

const CUT_MODES = ['Smooth', 'Natural', 'Jumpy'] as const;
type CutMode = (typeof CUT_MODES)[number];

/** Max narration upload. Matches the ceiling the /api/vater/upload token
 *  issues for audio — keep the two in step. */
const NARRATION_MAX_BYTES = 50 * 1024 * 1024;

type PronRow = { word: string; phonetic: string };

type SceneLine = { idx: number; text: string };

/** scenesJson is [{idx, beatText, startS, …}] — pull the narrated line out of
 *  each entry so a single mispronounced sentence can be re-voiced on its own. */
function readSceneLines(scenesJson: unknown): SceneLine[] {
  if (!Array.isArray(scenesJson)) return [];
  return scenesJson
    .map((raw, i): SceneLine | null => {
      if (!raw || typeof raw !== 'object') return null;
      const o = raw as Record<string, unknown>;
      const text = typeof o.beatText === 'string' ? o.beatText.trim() : '';
      if (!text) return null;
      return { idx: typeof o.idx === 'number' ? o.idx : i, text };
    })
    .filter((s): s is SceneLine => s !== null);
}

export function VoiceoverStep({
  projectId,
  project,
  refresh,
}: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [cutSilences, setCutSilences] = React.useState<CutMode>('Natural');
  // 402 from a generation route → actionable modal, not a raw error string.
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [showScript, setShowScript] = React.useState(false);
  const [voiceClone, setVoiceClone] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (project?.voiceCloneName) setVoiceClone(project.voiceCloneName);
  }, [project?.voiceCloneName]);

  /* ── Feature bag (2026-08-16): language, pronunciations, BYO narration ── */
  const features = React.useMemo(
    () => readFeatures(project?.settingsJson),
    [project?.settingsJson],
  );

  const [toast, setToast] = React.useState<string | null>(null);
  const [featureError, setFeatureError] = React.useState<string | null>(null);

  // Language ------------------------------------------------------------
  const [language, setLanguage] = React.useState<FeatureLanguage>('en');
  const [savingLanguage, setSavingLanguage] = React.useState(false);
  React.useEffect(() => {
    setLanguage(features.language ?? 'en');
  }, [features.language]);

  const handleLanguageChange = React.useCallback(
    async (next: FeatureLanguage) => {
      const previous = language;
      setLanguage(next);
      if (!projectId) return;
      setSavingLanguage(true);
      setFeatureError(null);
      try {
        // "en" is the default — clear the key rather than storing it, so the
        // feature bag only ever holds real deviations from today's behavior.
        await saveFeatures(projectId, { language: next === 'en' ? null : next });
        await refresh();
        setToast(
          next === 'en'
            ? 'Narration language set back to English.'
            : `Narration language set to ${FEATURE_LANGUAGES.find((l) => l.code === next)?.label}.`,
        );
      } catch (err) {
        setLanguage(previous);
        setFeatureError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSavingLanguage(false);
      }
    },
    [projectId, language, refresh],
  );

  // Pronunciations ------------------------------------------------------
  const [pronRows, setPronRows] = React.useState<PronRow[]>([]);
  const [pronSaving, setPronSaving] = React.useState(false);
  const [pronDirty, setPronDirty] = React.useState(false);
  React.useEffect(() => {
    const entries = Object.entries(features.pronunciations ?? {});
    setPronRows(entries.map(([word, phonetic]) => ({ word, phonetic })));
    setPronDirty(false);
  }, [features.pronunciations]);

  const updatePronRow = React.useCallback(
    (index: number, patch: Partial<PronRow>) => {
      setPronRows((rows) =>
        rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      );
      setPronDirty(true);
    },
    [],
  );

  const handleSavePronunciations = React.useCallback(async () => {
    if (!projectId) return;
    setPronSaving(true);
    setFeatureError(null);
    try {
      const map: Record<string, string> = {};
      for (const row of pronRows) {
        const word = row.word.trim();
        const phonetic = row.phonetic.trim();
        if (word && phonetic) map[word] = phonetic;
      }
      await saveFeatures(projectId, {
        pronunciations: Object.keys(map).length ? map : null,
      });
      await refresh();
      setPronDirty(false);
      setToast(
        Object.keys(map).length
          ? `Saved ${Object.keys(map).length} pronunciation${Object.keys(map).length === 1 ? '' : 's'}.`
          : 'Pronunciation list cleared.',
      );
    } catch (err) {
      setFeatureError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPronSaving(false);
    }
  }, [projectId, pronRows, refresh]);

  // BYO narration -------------------------------------------------------
  const narrationUrl = features.narrationUrl ?? null;
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleNarrationFile = React.useCallback(
    async (file: File) => {
      if (!projectId) return;
      if (file.size > NARRATION_MAX_BYTES) {
        setFeatureError(
          `That file is ${(file.size / 1024 / 1024).toFixed(0)}MB — the limit is 50MB. Export a compressed MP3 and try again.`,
        );
        return;
      }
      setUploading(true);
      setFeatureError(null);
      try {
        // Client upload: the file streams browser → Blob. A serverless
        // request body is capped at 4.5MB, so a 50MB WAV can never go
        // through the multipart path (feedback_body_size_limit).
        const blob = await upload(`narration/${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/vater/upload',
        });
        await saveFeatures(projectId, { narrationUrl: blob.url });
        await refresh();
        setToast('Narration uploaded — captions and scenes will align to it.');
      } catch (err) {
        setFeatureError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [projectId, refresh],
  );

  const handleRemoveNarration = React.useCallback(async () => {
    if (!projectId) return;
    setUploading(true);
    setFeatureError(null);
    try {
      await saveFeatures(projectId, { narrationUrl: null });
      await refresh();
      setToast('Back to generated voiceover.');
    } catch (err) {
      setFeatureError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setUploading(false);
    }
  }, [projectId, refresh]);

  // Per-scene re-voice --------------------------------------------------
  const sceneLines = React.useMemo(
    () => readSceneLines(project?.scenesJson),
    [project?.scenesJson],
  );
  const [showScenes, setShowScenes] = React.useState(false);
  const [lineEdits, setLineEdits] = React.useState<Record<number, string>>({});
  const [revoicingIdx, setRevoicingIdx] = React.useState<number | null>(null);
  const [revoiceOff, setRevoiceOff] = React.useState(false);

  const handleRevoiceLine = React.useCallback(
    async (line: SceneLine) => {
      if (!projectId) return;
      setRevoicingIdx(line.idx);
      setFeatureError(null);
      try {
        const edited = (lineEdits[line.idx] ?? line.text).trim();
        const data = await featureFetch<{ audioUrl?: string; durationSec?: number }>(
          `/api/vater/youtube/${projectId}/revoice-line`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sceneIndex: line.idx,
              ...(edited && edited !== line.text ? { text: edited } : {}),
            }),
          },
        );
        await refresh();
        setToast(
          data.durationSec
            ? `Scene ${line.idx + 1} re-voiced (${data.durationSec.toFixed(1)}s).`
            : `Scene ${line.idx + 1} re-voiced.`,
        );
      } catch (err) {
        if (err instanceof FeatureUnavailableError) {
          setRevoiceOff(true);
          setToast(err.message || COMING_ONLINE);
        } else {
          setFeatureError(err instanceof Error ? err.message : 'Re-voice failed');
        }
      } finally {
        setRevoicingIdx(null);
      }
    },
    [projectId, lineEdits, refresh],
  );

  const handleVoiceChange = React.useCallback(
    async (name: string) => {
      setVoiceClone(name);
      if (!projectId) return;
      try {
        await fetch(`/api/vater/youtube/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceName: name }),
        });
        await refresh();
      } catch {
        // PATCH errors here aren't loud — picker ui already gives feedback.
      }
    },
    [projectId, refresh],
  );

  const handleGenerate = React.useCallback(async () => {
    // Re-running TTS through the existing pipeline goes via context.
    if (!projectId) {
      setGenError('Start a project before generating voiceover.');
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceCloneName: voiceClone,
        }),
      });
      await assertOk(res);
      await refresh();
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
      } else {
        setGenError(err instanceof Error ? err.message : 'Generate failed');
      }
    } finally {
      setGenerating(false);
    }
  }, [projectId, voiceClone, refresh]);

  // Audio URL — prefer the project-scoped proxy so Range works (risk #10).
  const audioSrc = projectId ? `/api/vater/youtube/${projectId}/audio` : null;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <VCard>
        <SectionHeader
          icon="mic"
          title="Voiceover Generator"
          description="Generate professional AI voiceovers from your script using multiple voice options"
          actionLabel={generating ? 'Generating…' : 'Generate'}
          onAction={generating ? undefined : handleGenerate}
          creditCost={SECTION_PRICES.voiceover}
        />

        {/* Show Script accordion */}
        <div
          onClick={() => setShowScript((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${t.border}`,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>
            Show Script
          </span>
          <span style={{ fontSize: 12, color: t.textSecondary }}>
            • {project?.script
              ? `${project.script.split(/\s+/).filter(Boolean).length} words`
              : 'no script yet'}
          </span>
          <div style={{ flex: 1 }} />
          <Icon name="chevronDown" size={18} color={t.textSecondary} />
        </div>
        {showScript && project?.script && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              maxHeight: 200,
              overflowY: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              color: t.text,
              whiteSpace: 'pre-wrap',
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
              background: t.cardAlt,
            }}
          >
            {project.script}
          </div>
        )}

        {/* Language — non-English routes TTS through the multilingual path
            and is also the target for "Translate script" in the Script step. */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: t.text,
              marginBottom: 8,
            }}
          >
            Language
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select
              value={language}
              disabled={savingLanguage || !projectId || Boolean(narrationUrl)}
              onChange={(e) =>
                handleLanguageChange(e.target.value as FeatureLanguage)
              }
              data-testid="voiceover-language"
              style={{
                padding: '8px 12px',
                borderRadius: JELLY_TOKENS.radius.sm,
                border: `1px solid ${t.border}`,
                background: t.card,
                color: t.text,
                fontSize: 14,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              {FEATURE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: t.textSecondary }}>
              {narrationUrl
                ? 'Not used — your own narration sets the language.'
                : language === 'en'
                  ? 'English narration (default).'
                  : 'Translate the script in the Script step to match.'}
            </span>
          </div>
        </div>

        {/* BYO narration — when set, TTS is skipped entirely. */}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${narrationUrl ? JELLY_TOKENS.brand : t.border}`,
            background: narrationUrl ? JELLY_TOKENS.brandGhost : t.cardAlt,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="upload" size={16} color={t.textSecondary} />
            <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
              Upload my own narration
            </span>
            <span style={{ fontSize: 12, color: t.textSecondary }}>
              WAV / MP3, up to 50MB
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleNarrationFile(file);
            }}
          />

          {narrationUrl ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, color: t.text, marginBottom: 8 }}>
                Using your narration — captions &amp; scenes will align to it.
              </div>
              <audio controls src={narrationUrl} style={{ width: '100%' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <VBtn
                  size="sm"
                  variant="outlined"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !projectId}
                >
                  {uploading ? 'Uploading…' : 'Replace file'}
                </VBtn>
                <VBtn
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveNarration}
                  disabled={uploading}
                  data-testid="narration-remove"
                >
                  Use a generated voice instead
                </VBtn>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <VBtn
                size="sm"
                variant="outlined"
                icon="upload"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !projectId}
                data-testid="narration-upload"
              >
                {uploading ? 'Uploading…' : 'Choose audio file'}
              </VBtn>
              <div
                style={{
                  fontSize: 11,
                  color: t.textSecondary,
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                Skips text-to-speech completely. Scene timings and captions are
                aligned to your recording instead.
              </div>
            </div>
          )}
        </div>

        {/* Voice Settings — hidden while BYO narration is in play, since
            nothing on the pipeline would read it. */}
        {!narrationUrl && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: t.text,
                marginBottom: 8,
              }}
            >
              Voice Settings
            </div>
            <YouTubeVoiceClonePanel
              mode="select"
              value={voiceClone}
              onChange={handleVoiceChange}
            />
          </div>
        )}

        {/* Audio player */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 6 }}>
            Generated audio
          </div>
          {audioSrc && project?.audioUrl ? (
            // Native <audio> — keeps Range header forwarding intact (risk #10).
            <audio
              controls
              src={audioSrc}
              style={{ width: '100%' }}
            />
          ) : (
            <div
              style={{
                padding: 16,
                fontSize: 13,
                color: t.textSecondary,
                border: `1px dashed ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                textAlign: 'center',
              }}
            >
              No audio yet. Pick a voice clone and click Generate.
            </div>
          )}
        </div>

        {/* Say it as… — pronunciation dictionary applied at synthesis time. */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                Say it as…
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                Spell a word the way it should sound. “Tolley” → “TAH-lee”.
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <VBtn
              size="sm"
              onClick={handleSavePronunciations}
              disabled={pronSaving || !pronDirty || !projectId}
              data-testid="pronunciations-save"
            >
              {pronSaving ? 'Saving…' : pronDirty ? 'Save' : 'Saved'}
            </VBtn>
          </div>

          {pronRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pronRows.map((row, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <VInput
                      value={row.word}
                      onChange={(v) => updatePronRow(i, { word: v })}
                      placeholder="Word as written"
                    />
                  </div>
                  <span style={{ color: t.textSecondary, fontSize: 13 }}>→</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <VInput
                      value={row.phonetic}
                      onChange={(v) => updatePronRow(i, { phonetic: v })}
                      placeholder="How it should sound"
                    />
                  </div>
                  <div
                    onClick={() => {
                      setPronRows((rows) => rows.filter((_, j) => j !== i));
                      setPronDirty(true);
                    }}
                    title="Remove"
                    style={{ cursor: 'pointer', padding: 6 }}
                  >
                    <Icon name="close" size={16} color={t.textSecondary} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <VBtn
            size="sm"
            variant="text"
            icon="plus"
            onClick={() => {
              setPronRows((rows) => [...rows, { word: '', phonetic: '' }]);
              setPronDirty(true);
            }}
            style={{ marginTop: pronRows.length ? 8 : 0, paddingLeft: 0 }}
            data-testid="pronunciations-add"
          >
            Add a word
          </VBtn>
        </div>

        {/* Per-scene re-voice — fix one line without paying for a full
            narration re-run. */}
        {sceneLines.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              onClick={() => setShowScenes((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>
                Re-voice a single line
              </span>
              <span style={{ fontSize: 12, color: t.textSecondary }}>
                • {sceneLines.length} scenes
              </span>
              <div style={{ flex: 1 }} />
              <Icon name="chevronDown" size={18} color={t.textSecondary} />
            </div>

            {showScenes && (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 420,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {sceneLines.map((line) => {
                  const value = lineEdits[line.idx] ?? line.text;
                  const busy = revoicingIdx === line.idx;
                  return (
                    <div
                      key={line.idx}
                      style={{
                        padding: 10,
                        borderRadius: JELLY_TOKENS.radius.md,
                        border: `1px solid ${t.border}`,
                        background: t.cardAlt,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.textSecondary,
                          marginBottom: 6,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        Scene {line.idx + 1}
                      </div>
                      <textarea
                        value={value}
                        onChange={(e) =>
                          setLineEdits((prev) => ({
                            ...prev,
                            [line.idx]: e.target.value,
                          }))
                        }
                        rows={2}
                        style={{
                          width: '100%',
                          resize: 'vertical',
                          padding: 8,
                          borderRadius: JELLY_TOKENS.radius.sm,
                          border: `1px solid ${t.border}`,
                          background: t.card,
                          color: t.text,
                          fontFamily: JELLY_TOKENS.font,
                          fontSize: 13,
                          lineHeight: 1.5,
                          outline: 'none',
                        }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          marginTop: 6,
                        }}
                        title={revoiceOff ? COMING_ONLINE : 'Re-run TTS for this line only'}
                      >
                        <VBtn
                          size="sm"
                          variant="outlined"
                          icon="mic"
                          onClick={() => handleRevoiceLine(line)}
                          disabled={busy || revoiceOff || revoicingIdx !== null}
                          data-testid={`revoice-line-${line.idx}`}
                        >
                          {busy ? 'Re-voicing…' : 'Re-voice this line'}
                        </VBtn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {featureError && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: JELLY_TOKENS.radius.md,
              background: 'rgba(220,38,38,0.08)',
              color: JELLY_TOKENS.error,
            }}
          >
            {featureError}
          </div>
        )}

        {/* Cut Silences */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="scissors" size={16} color={t.textSecondary} />
            <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>
              Cut Silences
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {CUT_MODES.map((mode) => {
                const active = cutSilences === mode;
                return (
                  <div
                    key={mode}
                    onClick={() => setCutSilences(mode)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: JELLY_TOKENS.radius.full,
                      fontSize: 13,
                      cursor: 'pointer',
                      border: `1px solid ${active ? JELLY_TOKENS.brand : t.border}`,
                      background: active ? JELLY_TOKENS.brandGhost : 'transparent',
                      color: active ? JELLY_TOKENS.brand : t.textSecondary,
                      fontWeight: 500,
                    }}
                  >
                    {mode}
                  </div>
                );
              })}
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: t.textSecondary,
              marginTop: 6,
              marginLeft: 28,
            }}
          >
            Smooth keeps more pauses, Natural is balanced, and Jumpy trims the
            hardest. (Pipeline-side support pending — toggle is local for now.)
          </div>
        </div>

        {genError && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: JELLY_TOKENS.radius.md,
              background: 'rgba(220,38,38,0.08)',
              color: JELLY_TOKENS.error,
            }}
          >
            {genError}
          </div>
        )}
      </VCard>

      {/* Popular voices auditioning panel (demo-only — preview audio).
          Hidden while BYO narration is set: nothing here would be used. */}
      {!narrationUrl && (
        <div style={{ marginTop: 16 }}>
          <YouTubePopularVoices />
        </div>
      )}
      <BillingBlockModal
        reason={billingBlock}
        onClose={() => setBillingBlock(null)}
      />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
