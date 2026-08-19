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
import { ElevenLabsConnect } from './ElevenLabsConnect';
import { TINT_BG, TINT_BORDER } from '../tint';

interface ElevenVoice {
  voice_id?: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
}

export function Voices(): React.ReactElement {
  const { t } = useTheme();
  const [tab, setTab] = React.useState<'own' | 'elevenlabs'>('own');
  const [elevenVoices, setElevenVoices] = React.useState<ElevenVoice[] | null>(
    null,
  );
  const [elevenError, setElevenError] = React.useState<string | null>(null);
  /* "You have no key" is not an error — the Connect card directly above is the
   * answer, so repeating the DGX's instructions in red under it just shouts. */
  const [notConnected, setNotConnected] = React.useState(false);

  // Loaded once, lazily — nobody pays for opening a tab.
  React.useEffect(() => {
    if (tab !== 'elevenlabs' || elevenVoices !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vater/voices/elevenlabs', {
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => ({}))) as {
          voices?: ElevenVoice[];
          error?: string;
          keySource?: 'byo' | 'house' | 'shared' | null;
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setElevenVoices(Array.isArray(data.voices) ? data.voices : []);
        // No keySource means the tenant never connected a key — that is the
        // Connect card's job, not a failure. Anything else IS a real upstream
        // failure and gets surfaced rather than showing a bare "no voices".
        const missingKey = !!data.error && !data.keySource;
        setNotConnected(missingKey);
        if (data.error && !missingKey) setElevenError(data.error);
      } catch (err) {
        if (cancelled) return;
        setElevenVoices([]);
        setElevenError(
          err instanceof Error ? err.message : 'Could not reach ElevenLabs',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, elevenVoices]);
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

  const tabStrip = (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: t.card,
        borderRadius: JELLY_TOKENS.radius.pill,
        border: `1px solid ${t.border}`,
        alignSelf: 'flex-start',
      }}
    >
      {(
        [
          { id: 'own', label: 'Your voices' },
          { id: 'elevenlabs', label: 'ElevenLabs (your key)' },
        ] as const
      ).map((x) => (
        <div
          key={x.id}
          onClick={() => setTab(x.id)}
          style={{
            padding: '8px 16px',
            borderRadius: JELLY_TOKENS.radius.pill,
            cursor: 'pointer',
            background: tab === x.id ? JELLY_TOKENS.brand : 'transparent',
            color: tab === x.id ? JELLY_TOKENS.onGradient : t.textSecondary,
            fontSize: 13,
            fontWeight: tab === x.id ? 600 : 500,
          }}
        >
          {x.label}
        </div>
      ))}
    </div>
  );

  if (tab === 'elevenlabs') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {tabStrip}

        <div
          style={{
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            ...TINT_BG.warning,
            border: `1px solid ${TINT_BORDER.warning}`,
            fontSize: 12,
            color: t.textSecondary,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: JELLY_TOKENS.warning }}>
            Bring your own account:
          </strong>{' '}
          ElevenLabs narration runs on the key you connect below, so the
          characters come off your own ElevenLabs plan and Jelly bills you
          nothing for the narration. Your own voice clones stay free, so pick
          an ElevenLabs voice only when you specifically want it (multilingual
          narration is the usual reason).
        </div>

        {/* Connect / replace / disconnect. Clearing the cached voice list on
            change is the point of the callback: the picker below must always
            be showing the account the render will actually use. */}
        <ElevenLabsConnect
          onChanged={() => {
            setElevenVoices(null);
            setElevenError(null);
            setNotConnected(false);
          }}
        />

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
            Preview a shared ElevenLabs voice before you commit a project to
            it.
          </p>
          <div className="jelly-legacy">
            <YouTubePopularVoices />
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: t.text,
              marginBottom: 6,
            }}
          >
            Voices on your ElevenLabs account
          </div>
          {elevenVoices === null && (
            <div style={{ fontSize: 12, color: t.textSecondary }}>
              Loading…
            </div>
          )}
          {elevenError && (
            <div
              style={{
                fontSize: 12,
                color: JELLY_TOKENS.error,
                marginBottom: 8,
              }}
            >
              {elevenError}
            </div>
          )}
          {elevenVoices !== null &&
            elevenVoices.length === 0 &&
            !elevenError && (
              <div style={{ fontSize: 12, color: t.textSecondary }}>
                {notConnected
                  ? 'Connect your key above and your account’s voices appear here.'
                  : 'No voices on this ElevenLabs account yet.'}
              </div>
            )}
          {elevenVoices !== null && elevenVoices.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 8,
              }}
            >
              {elevenVoices.map((v, i) => (
                <div
                  key={v.voice_id || `${v.name}-${i}`}
                  style={{
                    padding: '8px 10px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.border}`,
                    fontSize: 12,
                    color: t.text,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{v.name || 'Unnamed'}</div>
                  <div style={{ fontSize: 11, color: t.textSecondary }}>
                    {[v.category, v.labels?.accent, v.labels?.gender]
                      .filter(Boolean)
                      .join(' • ') || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {tabStrip}

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
        <div className="jelly-legacy">
          <YouTubePopularVoices />
        </div>
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
        <div className="jelly-legacy">
          <YouTubeVoiceClonePanel
            mode="manage"
            unlimited={capabilities.voicesWrite}
          />
        </div>
      </div>

      <div
        style={{
          padding: '10px 14px',
          borderRadius: JELLY_TOKENS.radius.md,
          ...TINT_BG.warning,
          border: `1px solid ${TINT_BORDER.warning}`,
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
