'use client';

/* Voices tab — F5-TTS clone management + ElevenLabs audition.
 *
 * Sources:
 *   - components/vater/youtube-voice-clone-panel.tsx (515 lines, §2.12)
 *     mode="manage" → upload + list + delete clones
 *   - components/vater/youtube-popular-voices.tsx (174 lines, §2.13)
 *     ElevenLabs popular voices preview
 *
 * Risk honoured: F5-TTS local default — ElevenLabs is OPT-IN. The
 * audition rail is presented above as a reference panel, not a default.
 * Voice sample URLs are encoded by the wrapped panel via
 * encodeURIComponent(name) (memory: §8.24). Clone uploads >4.5MB still
 * route through /api/vater/voices multipart — the contract flags this as
 * a known risk; the redesign should migrate to @vercel/blob client.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { useTier } from '../../tier-context';
import { YouTubeVoiceClonePanel } from '@/components/vater/youtube-voice-clone-panel';
import { YouTubePopularVoices } from '@/components/vater/youtube-popular-voices';
import { VoiceTuner } from './VoiceTuner';

export function Voices(): React.ReactElement {
  const { t } = useTheme();
  // Cloning your own voice is open to every tier (2026-08-15): uploads land in
  // a per-user namespace on the DGX, so one customer's clone is invisible to
  // everyone else. `voicesWrite` now only decides who gets the Voice Tuner,
  // which spends (small) Modal money per audition and stays studio/owner.
  const { capabilities } = useTier();

  const cardStyle: React.CSSProperties = {
    padding: 16,
    borderRadius: JELLY_TOKENS.radius.lg,
    background: t.card,
    border: `1px solid ${t.border}`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Audition rail — top per contract */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: t.text,
            marginBottom: 6,
          }}
        >
          ✦ Audition popular voices
        </div>
        <p
          style={{
            fontSize: 11,
            color: t.textSecondary,
            margin: '0 0 12px',
            lineHeight: 1.5,
          }}
        >
          ElevenLabs shared voices — preview-only. To use one in a project
          you still need a local F5-TTS clone (default backend, free, runs
          on the DGX).
        </p>
        <YouTubePopularVoices />
      </div>

      {/* Voice Tuner — EQ / delivery control panel with instant ~30s samples,
          lock-in writes <ownerDir>/<Name>.tuning.json on the DGX (8/15).
          Studio/owner only: every audition is a real Modal call that isn't
          metered against customer credits. */}
      {capabilities.voicesWrite && <VoiceTuner />}

      {/* Clone management — open to every tier. Uploads land in the caller's
          own namespace (u_<userId>), so they're invisible to other accounts. */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: t.text,
            marginBottom: 6,
          }}
        >
          Your voice clones
        </div>
        <p
          style={{
            fontSize: 11,
            color: t.textSecondary,
            margin: '0 0 12px',
            lineHeight: 1.5,
          }}
        >
          Upload a 5-second clean speech sample with its exact transcript. The
          clone is private to your account and narrates any project you point
          at it. Voices marked <strong>Shared</strong> come with the studio and
          are available to everyone.
        </p>
        <YouTubeVoiceClonePanel
          mode="manage"
          unlimited={capabilities.voicesWrite}
        />
      </div>

      <div
        style={{
          padding: '10px 14px',
          borderRadius: JELLY_TOKENS.radius.md,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.4)',
          fontSize: 11,
          color: t.textSecondary,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: JELLY_TOKENS.warning }}>Heads up:</strong>{' '}
        voice samples larger than ~4.5MB upload through a Serverless route
        and will silently 500. Trim to a 5-second WAV before uploading.
      </div>
    </div>
  );
}
