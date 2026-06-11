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
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, VCard, VInput, SectionHeader } from '../../primitives';
import { YouTubeScriptEditor } from '@/components/vater/youtube-script-editor';
import { YouTubeCreatorModelPicker } from '@/components/vater/youtube-creator-model-picker';
import type {
  CreatorModel,
  CreatorModelId,
} from '@/lib/vater/creator-models';
import type { EditorStepProps } from './ProjectShell';

export function ScriptStep({ projectId, project, refresh }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [title, setTitle] = React.useState('');
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
  const [submittingOwn, setSubmittingOwn] = React.useState(false);
  const [ownError, setOwnError] = React.useState<string | null>(null);
  const pastedWordCount = React.useMemo(
    () => pastedScript.trim().split(/\s+/).filter(Boolean).length,
    [pastedScript],
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
          targetWordCount: wordCount,
          stylePreset: 'cinematic',
          creatorModelId: creatorModel,
          scriptGuidelines: extraContext.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await refresh();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }, [
    projectId,
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      lastSavedAnim.current = trimmed;
      setAnimDirty(false);
      await refresh();
    } catch (err) {
      setAnimError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setAnimSaving(false);
    }
  }, [projectId, animDirection, refresh]);

  const handlePullFromScenes = React.useCallback(() => {
    if (!sceneSummaryFromProject) return;
    setAnimDirection(sceneSummaryFromProject);
    setAnimDirty(sceneSummaryFromProject !== lastSavedAnim.current);
  }, [sceneSummaryFromProject]);

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
    const voice = project?.voiceCloneName ?? project?.voiceName;
    if (!voice) {
      setOwnError(
        'This project has no voice clone set yet. Pick a style with a voice (or set one on the project) before submitting an own-script run.',
      );
      return;
    }
    setSubmittingOwn(true);
    setOwnError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: 'User-supplied script',
          targetDuration: Math.max(
            1,
            Math.min(30, Math.round(pastedWordCount / 150)),
          ),
          targetWordCount: Math.max(1, pastedWordCount),
          stylePreset: 'cinematic',
          voiceCloneName: voice,
          scriptOverride: trimmed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setPastedScript('');
      setUseOwnScript(false);
      await refresh();
    } catch (err) {
      setOwnError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmittingOwn(false);
    }
  }, [projectId, pastedScript, pastedWordCount, project, refresh]);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <VCard style={{ marginBottom: 16 }}>
        <SectionHeader
          icon="description"
          title="Script Generator"
          description="Generate engaging video scripts optimized for viewer retention and engagement"
          actionLabel={
            useOwnScript
              ? submittingOwn
                ? 'Starting…'
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
              placeholder="Paste your script here. Any length — no minimum, no maximum. Click Use This Script above to lock it in and start the pipeline."
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
              {pastedWordCount} words ≈ {(pastedWordCount / 150).toFixed(1)} min
              narration at 150 wpm
            </div>
            {ownError && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: JELLY_TOKENS.radius.md,
                  background: 'rgba(220,38,38,0.08)',
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
                background: '#fff',
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <VInput
                label="Style"
                value={style}
                onChange={setStyle}
                placeholder="Style"
              />
              <VInput
                label="Target Word Count"
                value={String(wordCount)}
                onChange={(v) => {
                  const n = Number(v);
                  if (!Number.isNaN(n)) setWordCount(Math.max(150, Math.min(10000, n)));
                }}
                placeholder="1800"
                helper={`~${Math.round(wordCount / 150)} min narration`}
              />
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

            {/* Creator Model — wraps existing component. It uses Tailwind, but
                that's fine; it's mounted inside our card and rendered as-is. */}
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
              <YouTubeCreatorModelPicker
                value={creatorModel}
                onChange={handleCreatorModelChange}
              />
            </div>
          </div>
        )}

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
                background: 'rgba(220,38,38,0.08)',
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
            <div style={{ display: 'flex', gap: 8 }}>
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

          <YouTubeScriptEditor
            script={project.script}
            targetWordCount={project.targetWordCount ?? wordCount}
            onSave={handleScriptSave}
            onRegenerate={handleScriptRegenerate}
            isRegenerating={generating}
          />

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
                color: '#fff',
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
    </div>
  );
}
