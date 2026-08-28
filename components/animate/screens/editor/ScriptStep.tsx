'use client';

/* ScriptStep — Step 2.
 *
 * Generator panel + script viewer.
 * - Title input (max 100)
 * - Web Search toggle (project-context ride-along; not wired to backend yet)
 * - Show Options accordion: Style + Target Word Count + Video Context URL +
 *   Additional Context
 * - Creator Model dropdown wraps the existing YouTubeCreatorModelPicker
 * - Body uses the existing YouTubeScriptEditor for word counter + Edit/Save.
 *
 * Generate calls POST /api/vater/youtube/[id]/context if a project exists
 * (transitions transcribed → extracting_principles via autopilot.runCreation).
 * If no project exists yet, we POST /api/vater/youtube with { url } when the
 * Title source is "channel", or fall through to a topic-mode hint otherwise.
 *
 * Goal/duration separation contract: changing Creator Model NEVER auto-fills
 * the word-count slider. The user picks both independently (memory:
 * feedback_goal_vs_duration_separation.md).
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, VCard, VInput, SectionHeader, Toast } from '../../primitives';
import {
  readFeatures,
  FEATURE_LANGUAGES,
} from '@/lib/vater/project-features';
import {
  featureFetch,
  FeatureUnavailableError,
  COMING_ONLINE,
} from './feature-fetch';
import { YouTubeScriptEditor } from '@/components/vater/youtube-script-editor';
import { YouTubeCreatorModelPicker } from '@/components/vater/youtube-creator-model-picker';
import { creatorModelsForTier } from '@/lib/vater/creator-models';
import { useTier } from '../../tier-context';
import type {
  CreatorModel,
  CreatorModelId,
} from '@/lib/vater/creator-models';
import type { EditorStepProps } from './ProjectShell';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockReason,
} from './BillingBlock';
import { TINT_BG } from '../tint';
import { reelLabel } from './reel-label';
import { EnginePicker, type ConciergeEngine } from '../../engine/EnginePicker';
import { RenderConfirmModal, type RenderManifest } from '../../engine/RenderConfirmModal';
import { useRenderEstimate } from './use-render-estimate';
import { quickEstimateUsd, quoteMinutes, ESTIMATE_WORDS_PER_MINUTE } from '@/lib/vater/billing/estimate';

export function ScriptStep({ projectId, project, refresh, goToStep }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const { tier } = useTier();
  const creatorModelsAvailable = creatorModelsForTier(tier).length > 0;
  const [title, setTitle] = React.useState('');
  // 402 from a generation route → actionable modal, not a raw error string.
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [webSearch, setWebSearch] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);
  const [style, setStyle] = React.useState('Finance');
  const [wordCount, setWordCount] = React.useState(1800);
  const [contextUrl, setContextUrl] = React.useState('');
  const [extraContext, setExtraContext] = React.useState('');
  const [creatorModel, setCreatorModel] = React.useState<CreatorModelId | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);

  // Animation direction — editable summary that biases scene-prompt
  // generation downstream. Persists to project.customStylePrompt.
  const [animDirection, setAnimDirection] = React.useState('');
  const [animDirty, setAnimDirty] = React.useState(false);
  const [animSaving, setAnimSaving] = React.useState(false);
  const [animError, setAnimError] = React.useState<string | null>(null);
  const lastSavedAnim = React.useRef<string>('');

  // Own-script mode — paste a script; F5-TTS reads it verbatim, scenes plan
  // off it directly. Mirrors the V1 topic-form. Routed through /context with
  // scriptOverride; the route handles draft/scripted projects in this case.
  const [useOwnScript, setUseOwnScript] = React.useState(false);
  const [pastedScript, setPastedScript] = React.useState('');
  // Director notes → ticket customerNote (Fable 5 only). See StylePickerModal.
  const [directorNotes, setDirectorNotes] = React.useState('');
  const [submittingOwn, setSubmittingOwn] = React.useState(false);
  const [ownError, setOwnError] = React.useState<string | null>(null);
  // Engine for the own-script lane (2026-08-19): Jelly Auto → /context as
  // before; Fable 5 Concierge → POST .../concierge (human-directed ticket).
  const [engine, setEngine] = React.useState<ConciergeEngine>('auto');
  const projectEstimate = useRenderEstimate(projectId);
  // Confirm-before-Fable-5 (2026-08-20): "Send to Fable 5" opens the manifest
  // modal; the ticket POST only fires from the modal's confirm button.
  const [f5Confirm, setF5Confirm] = React.useState(false);
  const [f5Manifest, setF5Manifest] = React.useState<RenderManifest | null>(null);
  const [f5ManifestLoading, setF5ManifestLoading] = React.useState(false);
  const [f5ManifestError, setF5ManifestError] = React.useState<string | null>(null);
  const pastedWordCount = React.useMemo(
    () => pastedScript.trim().split(/\s+/).filter(Boolean).length,
    [pastedScript],
  );

  /* ── URL / PDF intake (2026-08-16) ────────────────────────────────────
   * Pulls an article, PDF or YouTube transcript into the reference box so
   * the writer has source material instead of just a title. The DGX handles
   * all three; the site falls back to an HTML readability pass. */
  const [importUrl, setImportUrl] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importOff, setImportOff] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  /* ── Translation (2026-08-16) ─────────────────────────────────────────
   * Target language lives in the feature bag and is picked in the Voiceover
   * step — one setting drives both the script and the TTS path. */
  const [translating, setTranslating] = React.useState(false);
  const [translateError, setTranslateError] = React.useState<string | null>(null);
  const [translateOff, setTranslateOff] = React.useState(false);

  const features = React.useMemo(
    () => readFeatures(project?.settingsJson),
    [project?.settingsJson],
  );
  const targetLanguage = features.language;
  const targetLanguageLabel = React.useMemo(
    () =>
      FEATURE_LANGUAGES.find((l) => l.code === targetLanguage)?.label ?? null,
    [targetLanguage],
  );

  // Hydrate from project on load
  React.useEffect(() => {
    if (!project) return;
    setTitle(project.sourceTitle ?? project.topic ?? '');
    if (project.targetWordCount) setWordCount(project.targetWordCount);
    const incoming = project.customStylePrompt ?? '';
    if (incoming !== lastSavedAnim.current) {
      lastSavedAnim.current = incoming;
      setAnimDirection(incoming);
      setAnimDirty(false);
    }
  }, [project]);

  const sceneSummaryFromProject = React.useMemo(() => {
    const raw = project?.scenesJson;
    if (!Array.isArray(raw)) return '';
    return raw
      .map((sc, i) => {
        if (!sc || typeof sc !== 'object') return null;
        const o = sc as Record<string, unknown>;
        const idx = typeof o.idx === 'number' ? o.idx : i;
        const prompt = typeof o.imagePrompt === 'string' ? o.imagePrompt.trim() : '';
        if (!prompt) return null;
        return `Scene ${idx + 1}: ${prompt}`;
      })
      .filter((line): line is string => line !== null)
      .join('\n\n');
  }, [project?.scenesJson]);

  const handleCreatorModelChange = React.useCallback((m: CreatorModel | null) => {
    setCreatorModel(m?.id ?? null);
    // Per goal-vs-duration separation: do NOT touch wordCount/duration here.
  }, []);

  const handleGenerate = React.useCallback(async () => {
    if (!projectId) {
      setGenError('No project loaded — start from the Dashboard.');
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      // ProjectShell-mode: project always exists. Refine context kicks
      // autopilot.runCreation on the DGX side, which transitions the
      // status through extracting_principles → scripting → scripted.
      const res = await fetch(`/api/vater/youtube/${projectId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The goal IS the brief the DGX writes from. Sending it was never
          // wired up, so this button 400'd ("goal is required") for everyone.
          goal:
            title.trim() ||
            project?.sourceTitle?.trim() ||
            project?.goal?.trim() ||
            undefined,
          voiceCloneName: project?.voiceName ?? project?.voiceCloneName ?? undefined,
          targetWordCount: wordCount,
          creatorModelId: creatorModel,
          scriptGuidelines: extraContext.trim() || undefined,
          // Script-review gate: the worker writes the script and PARKS.
          // Without this flag the whole paid pipeline (voice, scenes,
          // compose) ran silently off a 5¢ "generate script" click — the
          // 2026-08-19 runaway-render bug. Rendering is an explicit,
          // priced click on the Generate Video bar.
          stopAfterScript: true,
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
  }, [
    projectId,
    title,
    project?.sourceTitle,
    project?.goal,
    project?.voiceName,
    project?.voiceCloneName,
    wordCount,
    creatorModel,
    extraContext,
    refresh,
  ]);

  const handleScriptSave = React.useCallback(
    async (next: string) => {
      if (!projectId) return;
      try {
        await fetch(`/api/vater/youtube/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: next }),
        });
        await refresh();
      } catch {
        // Silent fail is anti-pattern, but the wrapped editor surfaces its own
        // edit state. We re-fetch to keep state consistent on success only.
      }
    },
    [projectId, refresh],
  );

  const handleScriptRegenerate = React.useCallback(async () => {
    await handleGenerate();
  }, [handleGenerate]);

  const handleSaveAnimDirection = React.useCallback(async () => {
    if (!projectId) return;
    setAnimSaving(true);
    setAnimError(null);
    try {
      const trimmed = animDirection.trim();
      const res = await fetch(`/api/vater/youtube/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customStylePrompt: trimmed }),
      });
      await assertOk(res);
      lastSavedAnim.current = trimmed;
      setAnimDirty(false);
      await refresh();
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
      } else {
        setAnimError(err instanceof Error ? err.message : 'Save failed');
      }
    } finally {
      setAnimSaving(false);
    }
  }, [projectId, animDirection, refresh]);

  const handlePullFromScenes = React.useCallback(() => {
    if (!sceneSummaryFromProject) return;
    setAnimDirection(sceneSummaryFromProject);
    setAnimDirty(sceneSummaryFromProject !== lastSavedAnim.current);
  }, [sceneSummaryFromProject]);

  const handleImportUrl = React.useCallback(async () => {
    const url = importUrl.trim();
    if (!url) {
      setImportError('Paste a link first.');
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const data = await featureFetch<{
        title?: string;
        text?: string;
        source?: string;
      }>('/api/vater/script/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const text = (data.text ?? '').trim();
      if (!text) {
        setImportError('Nothing readable came back from that link.');
        return;
      }
      // Reference material, not the script itself — the writer works from it.
      const header = `Source: ${data.source ?? url}\n\n`;
      const clipped = text.length > 8000 ? `${text.slice(0, 8000)}…` : text;
      setExtraContext((prev) =>
        prev.trim() ? `${prev.trim()}\n\n---\n\n${header}${clipped}` : header + clipped,
      );
      if (!title.trim() && data.title) setTitle(data.title.slice(0, 100));
      setShowOptions(true);
      setImportUrl('');
      setToast(
        `Pulled ${text.split(/\s+/).filter(Boolean).length} words into Additional Context.`,
      );
    } catch (err) {
      if (err instanceof FeatureUnavailableError) {
        setImportOff(true);
        setToast(err.message || COMING_ONLINE);
      } else {
        setImportError(err instanceof Error ? err.message : 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  }, [importUrl, title]);

  const handleTranslate = React.useCallback(async () => {
    if (!projectId || !project?.script || !targetLanguage) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const data = await featureFetch<{ text?: string }>(
        '/api/vater/script/translate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: project.script,
            targetLanguage,
          }),
        },
      );
      const next = (data.text ?? '').trim();
      if (!next) {
        setTranslateError('Translation came back empty.');
        return;
      }
      // Saved through the normal script path so it lands in scriptVersions
      // and the original stays one revert away.
      await handleScriptSave(next);
      setToast(`Script translated to ${targetLanguageLabel ?? targetLanguage}.`);
    } catch (err) {
      if (err instanceof FeatureUnavailableError) {
        setTranslateOff(true);
        setToast(err.message || COMING_ONLINE);
      } else {
        setTranslateError(err instanceof Error ? err.message : 'Translate failed');
      }
    } finally {
      setTranslating(false);
    }
  }, [
    projectId,
    project?.script,
    targetLanguage,
    targetLanguageLabel,
    handleScriptSave,
  ]);

  const handleSubmitOwnScript = React.useCallback(async () => {
    if (!projectId) {
      setOwnError('No project loaded — start from the Dashboard.');
      return;
    }
    const trimmed = pastedScript.trim();
    if (!trimmed) {
      setOwnError('Paste a script first.');
      return;
    }

    // ── Fable 5 Concierge: open the confirm modal first. The ticket POST
    // only fires from the modal — clicking "Send" alone must never queue a
    // ticket the customer didn't read the terms of (2026-08-20). ───────────
    if (engine === 'fable5') {
      setF5Confirm(true);
      setF5ManifestLoading(true);
      setF5ManifestError(null);
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}/preflight`);
        if (!res.ok) throw new Error(`Could not check the project setup (${res.status})`);
        const m = (await res.json()) as RenderManifest;
        // The pasted script hasn't been saved yet — quote ITS length, not the
        // stale project script's.
        const words = trimmed.split(/\s+/).filter(Boolean).length;
        setF5Manifest({
          ...m,
          words,
          estMinutes: quoteMinutes(words),
          blockers: m.blockers.filter((b) => b.code !== 'no_script' || words < 20),
        });
      } catch (err) {
        setF5ManifestError(err instanceof Error ? err.message : 'Could not check the project setup');
      } finally {
        setF5ManifestLoading(false);
      }
      return;
    }

    // Jelly Auto: SAVE the script only. Rendering is a separate, explicit,
    // priced click (Generate Video bar) — pasting a script must never start
    // a paid pipeline by itself (2026-08-19 runaway-render bug).
    setSubmittingOwn(true);
    setOwnError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: trimmed }),
      });
      await assertOk(res);
      setPastedScript('');
      setUseOwnScript(false);
      setToast(
        'Script saved ✓ — pick a voice, then hit Generate Video when you’re ready to render.',
      );
      await refresh();
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
      } else {
        setOwnError(err instanceof Error ? err.message : 'Submit failed');
      }
    } finally {
      setSubmittingOwn(false);
    }
  }, [projectId, pastedScript, refresh, engine]);

  /* The actual Fable 5 ticket POST — reachable only via the confirm modal. */
  const submitFable5 = React.useCallback(async () => {
    if (!projectId) return;
    const trimmed = pastedScript.trim();
    setSubmittingOwn(true);
    setOwnError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: trimmed,
          ...(directorNotes.trim() ? { note: directorNotes.trim().slice(0, 2000) } : {}),
        }),
      });
      await assertOk(res);
      setF5Confirm(false);
      setPastedScript('');
      setUseOwnScript(false);
      setToast('Sent to Fable 5 — you’ll get an email when it lands.');
      await refresh();
    } catch (err) {
      setF5Confirm(false);
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
      } else {
        setOwnError(err instanceof Error ? err.message : 'Submit failed');
      }
    } finally {
      setSubmittingOwn(false);
    }
  }, [projectId, pastedScript, directorNotes, refresh]);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <VCard style={{ marginBottom: 16 }}>
        <SectionHeader
          icon="description"
          eyebrow={reelLabel(1)}
          title="Script Generator"
          description="Generate engaging video scripts optimized for viewer retention and engagement"
          actionLabel={
            useOwnScript
              ? submittingOwn
                ? engine === 'fable5'
                  ? 'Sending…'
                  : 'Saving…'
                : engine === 'fable5'
                  ? 'Send to Fable 5'
                  : 'Use This Script'
              : generating
                ? 'Generating…'
                : 'Generate'
          }
          onAction={
            useOwnScript
              ? submittingOwn
                ? undefined
                : handleSubmitOwnScript
              : generating
                ? undefined
                : handleGenerate
          }
          creditCost={useOwnScript ? '$0.00' : SECTION_PRICES.script}
        />

        {/* Use-my-own-script toggle. ON → paste textarea + skip principle
            extraction + script generation; F5-TTS reads the pasted text
            verbatim. OFF → standard DGX script generator. */}
        <label
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: 12,
            marginTop: 16,
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${useOwnScript ? JELLY_TOKENS.brand : t.border}`,
            background: useOwnScript ? JELLY_TOKENS.brandGhost : t.cardAlt,
            cursor: submittingOwn || generating ? 'not-allowed' : 'pointer',
            opacity: submittingOwn || generating ? 0.6 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={useOwnScript}
            disabled={submittingOwn || generating}
            onChange={(e) => {
              setUseOwnScript(e.target.checked);
              setOwnError(null);
              setGenError(null);
            }}
            style={{
              marginTop: 3,
              accentColor: JELLY_TOKENS.brand,
              cursor: submittingOwn || generating ? 'not-allowed' : 'pointer',
            }}
          />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: t.text }}>
              I already have a script — use mine
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 12,
                color: t.textSecondary,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              Skips principle extraction + script generation. F5-TTS reads
              your text verbatim; scenes plan off it directly.
            </span>
          </span>
        </label>

        {useOwnScript ? (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: t.textSecondary,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Your script
            </div>
            <textarea
              value={pastedScript}
              onChange={(e) => {
                setPastedScript(e.target.value);
                if (ownError) setOwnError(null);
              }}
              disabled={submittingOwn}
              rows={14}
              placeholder={
                engine === 'fable5'
                  ? 'Paste your finished script here. Click Send to Fable 5 above — Fable 5 directs and renders it in your style, and emails you when it lands.'
                  : 'Paste your script here. Click Use This Script above to save it — nothing renders (or costs anything) until you hit Generate Video.'
              }
              style={{
                width: '100%',
                resize: 'vertical',
                padding: 12,
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.card,
                color: t.text,
                fontFamily: JELLY_TOKENS.font,
                fontSize: 13,
                lineHeight: 1.5,
                outline: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>
              {pastedWordCount} words ≈ {(pastedWordCount / ESTIMATE_WORDS_PER_MINUTE).toFixed(1)} min
              narration at 150 wpm
            </div>
            {engine === 'fable5' && (
              <div style={{ marginTop: 10 }} data-testid="director-notes">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.textSecondary,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  Director notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </div>
                <textarea
                  value={directorNotes}
                  onChange={(e) => setDirectorNotes(e.target.value.slice(0, 2000))}
                  disabled={submittingOwn}
                  rows={3}
                  maxLength={2000}
                  data-testid="director-notes-input"
                  placeholder="e.g. Jeff narrates in most scenes · all vehicles outdoors, truck = pickup · no one inside a car · keep the host in one outfit"
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    padding: 10,
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.border}`,
                    background: t.card,
                    color: t.text,
                    fontFamily: JELLY_TOKENS.font,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    outline: 'none',
                  }}
                />
                <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>
                  Fable 5 directs every scene from these — staging, who appears, what must never be shown.
                </div>
              </div>
            )}

            {/* Engine — who renders this script. Fable 5 is a ticket, not a
                kickoff: the button above turns into "Send to Fable 5". */}
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.textSecondary,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Engine
              </div>
              <EnginePicker
                value={engine}
                onChange={(e) => {
                  setEngine(e);
                  setOwnError(null);
                }}
                estimateUsd={
                  projectEstimate.draftUsd !== null
                    ? projectEstimate.draftUsd
                    : pastedWordCount > 0
                      ? quickEstimateUsd(pastedWordCount)
                      : null
                }
                estimateLoading={projectEstimate.loading}
                disabled={submittingOwn}
                compact
              />
            </div>
            {ownError && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: JELLY_TOKENS.radius.md,
                  ...TINT_BG.error,
                  color: JELLY_TOKENS.error,
                  fontSize: 12,
                }}
              >
                {ownError}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <VInput
              value={title}
              onChange={setTitle}
              placeholder="Enter your video title"
              helper={`${title.length} / 100 characters`}
              maxLength={100}
            />

            {/* From a link or PDF — drops source material into Additional
                Context so the writer isn't working from a title alone. */}
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.cardAlt,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Icon name="web" size={16} color={t.textSecondary} />
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  From a link or PDF · free reference
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <VInput
                    value={importUrl}
                    onChange={(v) => {
                      setImportUrl(v);
                      if (importError) setImportError(null);
                    }}
                    placeholder="https://example.com/article  •  …/paper.pdf  •  a YouTube link"
                  />
                </div>
                <div
                  title={importOff ? COMING_ONLINE : 'Pull the text into Additional Context'}
                  style={{ flexShrink: 0 }}
                >
                  <VBtn
                    size="sm"
                    variant="outlined"
                    icon="download"
                    onClick={handleImportUrl}
                    disabled={importing || importOff || !importUrl.trim()}
                    data-testid="script-import-url"
                  >
                    {importing ? 'Reading…' : 'Import'}
                  </VBtn>
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: t.textSecondary,
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                {importOff
                  ? COMING_ONLINE
                  : 'Reads the page, the PDF, or a YouTube caption track and drops the text into Additional Context as reference. Free and instant, and it does NOT become your script. To rebuild a video FROM a YouTube link, start a new video and pick “Start from a video”.'}
              </div>
              {importError && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    ...TINT_BG.error,
                    color: JELLY_TOKENS.error,
                    fontSize: 12,
                  }}
                >
                  {importError}
                </div>
              )}
            </div>
          </div>
        )}

        {!useOwnScript && (
        <>
        {/* Web Search toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 16,
          }}
        >
          <div
            onClick={() => setWebSearch((v) => !v)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              cursor: 'pointer',
              padding: 2,
              background: webSearch ? JELLY_TOKENS.brand : t.border,
              transition: 'background .2s',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: JELLY_TOKENS.onGradient,
                transform: webSearch ? 'translateX(18px)' : 'translateX(0)',
                transition: 'transform .2s',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>
              Web Search
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary }}>
              Use real-time web data to enhance script accuracy
            </div>
          </div>
        </div>

        {/* Show Options accordion */}
        <div
          onClick={() => setShowOptions((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            cursor: 'pointer',
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${t.border}`,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>
            Show Options
          </span>
          <span style={{ fontSize: 12, color: t.textSecondary }}>
            • {style} • {wordCount} words
          </span>
          <div style={{ flex: 1 }} />
          <Icon name="chevronDown" size={18} color={t.textSecondary} />
        </div>

        {showOptions && (
          <div
            style={{
              padding: 16,
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <VInput
                label="Style"
                value={style}
                onChange={setStyle}
                placeholder="Style"
              />
              {/* Hidden once a script exists. Jared 2026-08-27 chose NOT to have
                  this re-run the writer, and `plannedMinutes()` ignores
                  targetDuration whenever a script is present — so with a script
                  on the row this control changes nothing at all, in the script
                  or in the price. A dial that does nothing is worse than no
                  dial. Regenerating from scratch still offers it. */}
              {!project?.script && (
              <VInput
                label="Target Word Count"
                value={String(wordCount)}
                onChange={(v) => {
                  const n = Number(v);
                  if (!Number.isNaN(n)) setWordCount(Math.max(150, Math.min(10000, n)));
                }}
                placeholder="1800"
                helper={`~${Math.round(wordCount / ESTIMATE_WORDS_PER_MINUTE)} min narration`}
              />
              )}
            </div>
            <VInput
              label="Video Context URL"
              value={contextUrl}
              onChange={setContextUrl}
              placeholder="https://youtube.com/..."
            />
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: t.textSecondary,
                  marginBottom: 6,
                }}
              >
                Additional Context
              </div>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="Anything else the script writer should know"
                rows={4}
                style={{
                  width: '100%',
                  fontSize: 14,
                  fontFamily: JELLY_TOKENS.font,
                  border: `1px solid ${t.border}`,
                  borderRadius: JELLY_TOKENS.radius.md,
                  background: t.card,
                  color: t.text,
                  outline: 'none',
                  padding: 12,
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Creator Model — wraps the existing Tailwind component. The
                `jelly-legacy` class re-skins it onto the cinema palette
                without editing anything under components/vater/. */}
            {creatorModelsAvailable && (
              <div
                className="jelly-legacy"
                style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}
              >
                <YouTubeCreatorModelPicker
                  value={creatorModel}
                  onChange={handleCreatorModelChange}
                />
              </div>
            )}
          </div>
        )}

        {genError && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: JELLY_TOKENS.radius.md,
              ...TINT_BG.error,
              color: JELLY_TOKENS.error,
            }}
          >
            {genError}
          </div>
        )}
        </>
        )}
      </VCard>

      {/* Animation & visual direction — paired with the script editor below.
          Two-box review per user request: top box is what the character /
          animation will likely look like (editable, used as customStylePrompt
          to bias scene-prompt generation), bottom box is the narration script
          itself. Hidden until a script exists, since pre-script the box has
          nothing meaningful in it. */}
      {project?.script && (
        <VCard style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 8,
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
                Character & Animation Direction
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                What the visuals will most likely look like. Edits here bias
                every scene prompt generated downstream — characters, palette,
                camera, vibe.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {sceneSummaryFromProject && (
                <VBtn
                  size="sm"
                  variant="outlined"
                  onClick={handlePullFromScenes}
                  disabled={animSaving}
                >
                  Pull from scenes
                </VBtn>
              )}
              <VBtn
                size="sm"
                onClick={handleSaveAnimDirection}
                disabled={animSaving || !animDirty}
              >
                {animSaving ? 'Saving…' : animDirty ? 'Save' : 'Saved'}
              </VBtn>
            </div>
          </div>
          <textarea
            value={animDirection}
            onChange={(e) => {
              setAnimDirection(e.target.value);
              setAnimDirty(e.target.value !== lastSavedAnim.current);
              if (animError) setAnimError(null);
            }}
            placeholder="e.g. Cinematic 1980s film grain, warm tungsten lighting, single male protagonist in a wool coat, slow dolly-in pacing, period-accurate props. Each scene leans on practical lighting and shallow depth of field."
            rows={8}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: 12,
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${t.border}`,
              background: t.card,
              color: t.text,
              fontFamily: JELLY_TOKENS.font,
              fontSize: 13,
              lineHeight: 1.5,
              outline: 'none',
            }}
          />
          {animError && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: JELLY_TOKENS.radius.md,
                ...TINT_BG.error,
                color: JELLY_TOKENS.error,
                fontSize: 12,
              }}
            >
              {animError}
            </div>
          )}
          {!sceneSummaryFromProject && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: t.textSecondary,
                fontStyle: 'italic',
              }}
            >
              Per-scene prompts will populate after the Visuals step runs
              Generate Prompts. Use “Pull from scenes” to fold them back in here
              once they exist.
            </div>
          )}
        </VCard>
      )}

      {/* Script viewer / editor */}
      {project?.script ? (
        <VCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
                Narration Script
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                The exact words F5-TTS will read aloud for the voiceover.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Translate — target language is the project's `language`
                  feature, picked in the Voiceover step so the script and the
                  TTS path can never disagree. */}
              <div
                title={
                  translateOff
                    ? COMING_ONLINE
                    : targetLanguage && targetLanguage !== 'en'
                      ? `Rewrite the narration in ${targetLanguageLabel}`
                      : 'Pick a language in the Voiceover step first'
                }
              >
                <VBtn
                  size="sm"
                  variant="outlined"
                  onClick={handleTranslate}
                  disabled={
                    translating ||
                    translateOff ||
                    !targetLanguage ||
                    targetLanguage === 'en'
                  }
                  data-testid="script-translate"
                >
                  {translating
                    ? 'Translating…'
                    : `Translate script${targetLanguageLabel && targetLanguage !== 'en' ? ` → ${targetLanguageLabel}` : ' →'}`}
                </VBtn>
              </div>
              <div
                style={{ cursor: 'pointer', padding: 6 }}
                onClick={() => {
                  if (project?.script) {
                    navigator.clipboard.writeText(project.script).catch(() => {});
                  }
                }}
                title="Copy script"
              >
                <Icon name="copy" size={18} color={t.textSecondary} />
              </div>
            </div>
          </div>

          {translateError && (
            <div
              style={{
                marginBottom: 12,
                padding: '8px 12px',
                borderRadius: JELLY_TOKENS.radius.md,
                ...TINT_BG.error,
                color: JELLY_TOKENS.error,
                fontSize: 12,
              }}
            >
              {translateError}
            </div>
          )}

          <div className="jelly-legacy">
            <YouTubeScriptEditor
              script={project.script}
              targetWordCount={project.targetWordCount ?? wordCount}
              onSave={handleScriptSave}
              onRegenerate={handleScriptRegenerate}
              isRegenerating={generating}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              marginTop: 16,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
                background: JELLY_TOKENS.success,
                color: JELLY_TOKENS.onGradient,
              }}
            >
              {project?.status ?? 'Completed'}
            </span>
          </div>
        </VCard>
      ) : (
        <VCard>
          <div style={{ fontSize: 14, color: t.textSecondary, textAlign: 'center', padding: 24 }}>
            No script yet. {projectId ? 'Click Generate above.' : 'Start a project from the Studio first.'}
          </div>
        </VCard>
      )}
      <RenderConfirmModal
        engine={f5Confirm ? 'fable5' : null}
        manifest={f5Manifest}
        loading={f5ManifestLoading}
        loadError={f5ManifestError}
        estimateUsd={pastedWordCount > 0 ? quickEstimateUsd(pastedWordCount) : null}
        confirming={submittingOwn}
        onConfirm={() => void submitFable5()}
        onClose={() => setF5Confirm(false)}
        onGoToStep={goToStep}
        onOpenStyles={() => setRoute('styles-list')}
      />
      <BillingBlockModal
        reason={billingBlock}
        onClose={() => setBillingBlock(null)}
      />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
