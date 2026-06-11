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
import { VCard, SectionHeader } from '../../primitives';
import { YouTubeVoiceClonePanel } from '@/components/vater/youtube-voice-clone-panel';
import { YouTubePopularVoices } from '@/components/vater/youtube-popular-voices';
import type { EditorStepProps } from './ProjectShell';

const CUT_MODES = ['Smooth', 'Natural', 'Jumpy'] as const;
type CutMode = (typeof CUT_MODES)[number];

export function VoiceoverStep({
  projectId,
  project,
  refresh,
}: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [cutSilences, setCutSilences] = React.useState<CutMode>('Natural');
  const [showScript, setShowScript] = React.useState(false);
  const [voiceClone, setVoiceClone] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (project?.voiceCloneName) setVoiceClone(project.voiceCloneName);
  }, [project?.voiceCloneName]);

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

        {/* Voice Settings — wrap existing voice clone panel (select mode). */}
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

      {/* Popular voices auditioning panel (demo-only — preview audio) */}
      <div style={{ marginTop: 16 }}>
        <YouTubePopularVoices />
      </div>
    </div>
  );
}
