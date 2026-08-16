'use client';

/* Voice Samples — the "10 advisor voices" gallery for a clone (default Monroe).
 *
 * Jared 2026-08-16: "adjust the voice in several different ways to create 10
 * different sample voices … professional finance advisor … friendly, warm,
 * knowledgeable … not yelling or too fast … click on these samples to listen
 * … no robotic sound or reverberation … crystal clear … tabs in the voice
 * section for Monroe … give me your top three picks and why."
 *
 * Every card is one complete tuning (gen knobs + ffmpeg chain) rendered on
 * Modal with the SAME code path renders use. Click a card → it plays. "Use
 * this" locks that tuning in for the voice; "Open in tuner" loads it as the
 * draft so the knobs can be nudged from there.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { voiceDisplayName } from '@/lib/vater/voice-ids';
import type { VoiceSample, VoiceSampleGallery, VoiceTuning } from '@/lib/vater/autopilot-client';

type Props = {
  voice: string;
  /** Load a sample's tuning into the tuner draft (parent switches tab). */
  onOpenInTuner: (tuning: VoiceTuning, label: string) => void;
  /** Parent re-reads the tuning doc after a lock so the header badge updates. */
  onLocked: () => void;
  canWrite: boolean;
};

const MEDAL = ['🥇', '🥈', '🥉'];

function fmtDur(s?: number): string {
  if (!s) return '';
  return `${s.toFixed(0)}s`;
}

export function VoiceSamples({ voice, onOpenInTuner, onLocked, canWrite }: Props): React.ReactElement {
  const { t } = useTheme();
  const [gal, setGal] = React.useState<VoiceSampleGallery | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 4000); };

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/vater/voices/${encodeURIComponent(voice)}/samples`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setGal((await r.json()) as VoiceSampleGallery);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [voice]);

  React.useEffect(() => { setGal(null); void load(); }, [load]);

  // poll while a build is running
  const generating = !!gal?.generating || (gal?.samples ?? []).some((s) => s.phase === 'queued' || s.phase === 'synth');
  React.useEffect(() => {
    if (!generating) return;
    const h = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(h);
  }, [generating, load]);

  // one shared <audio>; clicking a card swaps its source
  const play = (s: VoiceSample) => {
    if (s.phase !== 'done') return;
    const el = audioRef.current;
    if (!el) return;
    if (playing === s.id) {
      if (el.paused) void el.play().catch(() => {}); else el.pause();
      return;
    }
    el.src = `/api/vater/voices/${encodeURIComponent(voice)}/samples/${s.id}/audio`;
    setPlaying(s.id);
    setProgress(0);
    void el.play().catch(() => {});
  };
  const [paused, setPaused] = React.useState(true);

  const lock = async (s: VoiceSample) => {
    setBusy(s.id);
    try {
      const r = await fetch(`/api/vater/voices/${encodeURIComponent(voice)}/samples/${s.id}/lock`, { method: 'POST' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail || j.error || `HTTP ${r.status}`); }
      flash(`🔒 ${voiceDisplayName(voice)} now uses “${s.label}” on every render.`);
      await load();
      onLocked();
    } catch (e) {
      flash(`lock failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(null); }
  };

  const rebuild = async () => {
    if (!window.confirm(`Re-render all 10 samples for ${voiceDisplayName(voice)} on Modal (≈ $0.10–0.30 total)?`)) return;
    setBusy('__all');
    try {
      const r = await fetch(`/api/vater/voices/${encodeURIComponent(voice)}/samples`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail || j.error || `HTTP ${r.status}`); }
      flash('Building — first sample takes ~60s if Modal is cold, then ~15s each.');
      await load();
    } catch (e) {
      flash(`build failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(null); }
  };

  const picks = (gal?.picks ?? []).slice().sort((a, b) => a.rank - b.rank);
  const pickRank = (id: string) => picks.findIndex((p) => p.id === id);
  const samples = gal?.samples ?? [];
  const doneCount = samples.filter((s) => s.phase === 'done').length;
  const lockedId = gal?.lockedSample ?? null;
  const totalUsd = samples.reduce((a, s) => a + (s.usd ?? 0), 0);

  const card: React.CSSProperties = {
    padding: 12, borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${t.border}`, background: t.cardAlt,
    cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, transition: 'border-color .15s, background .15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => { const a = e.currentTarget; if (a.duration) setProgress(a.currentTime / a.duration); }}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => { setPaused(true); setProgress(0); }}
        style={{ display: 'none' }}
      />

      {/* header row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
          🎧 {voiceDisplayName(voice)} — 10 advisor voices
        </div>
        <span style={{ fontSize: 10.5, color: t.textSecondary }}>
          {generating ? `rendering on Modal… ${doneCount}/${samples.length}` : samples.length ? `${doneCount}/${samples.length} ready · $${totalUsd.toFixed(2)} total` : 'no samples yet'}
        </span>
        <span style={{ flex: 1 }} />
        {toast && <span style={{ fontSize: 11, color: t.text }}>{toast}</span>}
        {canWrite && (
          <VBtn size="sm" variant="outlined" disabled={busy === '__all' || generating} onClick={() => void rebuild()}>
            {samples.length ? '↻ Re-render all 10' : '▶ Build 10 samples'}
          </VBtn>
        )}
      </div>
      <p style={{ fontSize: 11, color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>
        Same script, ten different reads — pace, warmth, brightness, pitch and delivery each nudged a different way. All ten share the advisor
        floor: no room echo, gentle glue compression, matched loudness (−16 LUFS), rumble cut. <strong>Click a card to listen.</strong>{' '}
        “Use this” locks the read in for every render; “Open in tuner” lets you nudge it first.
      </p>
      {err && <div style={{ color: JELLY_TOKENS.error, fontSize: 12 }}>samples: {err}</div>}

      {/* top picks */}
      {picks.length > 0 && (
        <div style={{ padding: 12, borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${JELLY_TOKENS.brandOutline}`, background: JELLY_TOKENS.brandGhost }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 6 }}>⭐ Top {picks.length} picks</div>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {picks.map((p, i) => {
              const s = samples.find((x) => x.id === p.id);
              return (
                <li key={p.id} style={{ fontSize: 11.5, color: t.text, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, lineHeight: 1.2 }}>{MEDAL[i] ?? `#${p.rank}`}</span>
                  <div style={{ flex: 1 }}>
                    <button
                      type="button"
                      onClick={() => s && play(s)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: JELLY_TOKENS.brand, fontWeight: 700, fontSize: 12 }}
                    >
                      {playing === p.id && !paused ? '⏸' : '▶'} #{s?.n ?? '?'} {s?.label ?? p.id}
                    </button>
                    <span style={{ color: t.textSecondary }}> — {p.reason}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
        {samples.map((s) => {
          const isPlaying = playing === s.id;
          const rank = pickRank(s.id);
          const ready = s.phase === 'done';
          const isLocked = lockedId === s.id;
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => play(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(s); } }}
              style={{
                ...card,
                borderColor: isPlaying ? JELLY_TOKENS.brand : isLocked ? JELLY_TOKENS.success : t.border,
                background: isPlaying ? JELLY_TOKENS.brandGhost : t.cardAlt,
                opacity: ready ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 30, height: 30, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: ready ? JELLY_TOKENS.brand : t.hover, color: ready ? '#fff' : t.textSecondary, fontSize: 13, flexShrink: 0,
                  }}
                >
                  {!ready ? '…' : isPlaying && !paused ? '⏸' : '▶'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    #{s.n} {s.label}
                    {rank >= 0 && <span title={picks[rank]?.reason} style={{ marginLeft: 6 }}>{MEDAL[rank] ?? '⭐'}</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: t.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.tagline}</div>
                </div>
              </div>
              {/* progress */}
              <div style={{ height: 3, borderRadius: 2, background: t.hover, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${isPlaying ? progress * 100 : 0}%`, background: JELLY_TOKENS.brand, transition: 'width .2s linear' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: t.textSecondary }}>
                <span>
                  {s.phase === 'error' ? <span style={{ color: JELLY_TOKENS.error }}>✗ {s.error || 'failed'}</span>
                    : s.phase === 'synth' ? '⏳ speaking on Modal…'
                    : s.phase === 'queued' ? 'queued'
                    : `${fmtDur(s.durationS)} · $${(s.usd ?? 0).toFixed(3)}`}
                </span>
                {isLocked && <span style={{ color: JELLY_TOKENS.success, fontWeight: 600 }}>🔒 in use</span>}
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(expanded === s.id ? null : s.id); }}
                  style={{ background: 'none', border: 'none', color: JELLY_TOKENS.brand, cursor: 'pointer', fontSize: 10.5, padding: 0 }}
                >{expanded === s.id ? 'less' : 'why?'}</button>
              </div>
              {expanded === s.id && (
                <div style={{ fontSize: 11, color: t.text, lineHeight: 1.5 }} onClick={(e) => e.stopPropagation()}>
                  {s.why}
                  <div style={{ marginTop: 4, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 9.5, color: t.textSecondary, wordBreak: 'break-all' }}>
                    tempo {s.tuning.post.tempo.toFixed(2)}× · pause {s.tuning.gen.interval_silence_ms}ms · temp {s.tuning.gen.temperature.toFixed(2)} · beams {s.tuning.gen.num_beams}
                    {s.tuning.post.pitch_semitones ? ` · pitch ${s.tuning.post.pitch_semitones > 0 ? '+' : ''}${s.tuning.post.pitch_semitones} st` : ''}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <VBtn size="sm" variant={isLocked ? 'outlined' : 'primary'} disabled={!ready || !canWrite || busy === s.id || isLocked} onClick={() => void lock(s)}>
                  {isLocked ? '🔒 In use' : busy === s.id ? 'Locking…' : '🔒 Use this'}
                </VBtn>
                <VBtn size="sm" variant="text" disabled={!ready} onClick={() => onOpenInTuner(s.tuning, s.label)}>
                  Open in tuner
                </VBtn>
              </div>
            </div>
          );
        })}
      </div>
      {!samples.length && !err && gal && (
        <div style={{ fontSize: 12, color: t.textSecondary }}>No sample gallery for {voiceDisplayName(voice)} yet — hit “Build 10 samples”.</div>
      )}
      {!gal && !err && <div style={{ fontSize: 12, color: t.textSecondary }}>Loading samples…</div>}
    </div>
  );
}
