'use client';

/* Voice Tuner — per-voice control panel + equalizer with instant samples.
 *
 * Jared 2026-08-15: "make an equalizer or a control panel to be able to edit
 * Monroe's voice … hear a 30 second sample of what I've edited … then lock
 * in what I've changed."
 *
 * Two kinds of knobs, visually tagged:
 *   ● re-render  — IndexTTS-2 generation (delivery, emotion, pause length)
 *                  → needs a new ~30s Modal sample (pennies, ~10s warm)
 *   ⚡ live       — ffmpeg post chain (tempo, pitch, EQ, dynamics, level)
 *                  → re-applied to the cached take in ~1-3s, no GPU spend
 *
 * Truth is on the DGX (vater_voices/<Name>.tuning.json). "Lock in" writes it;
 * every render of that voice honors it from then on. Renders and previews run
 * the exact same code path (vater_voice_tuning.py) — what you hear is what
 * ships.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { isSharedVoiceId, voiceDisplayName } from '@/lib/vater/voice-ids';
import type {
  VoiceTuning,
  VoiceTuningDoc,
  VoicePreviewStatus,
} from '@/lib/vater/autopilot-client';

type VoiceRow = { name: string; sampleText?: string };
type Post = VoiceTuning['post'];
type Gen = VoiceTuning['gen'];

const EMO_KEYS = ['happy', 'angry', 'sad', 'afraid', 'disgusted', 'melancholic', 'surprised', 'calm'];
const EQ_BANDS = [80, 200, 500, 1200, 3000, 6000, 12000];
const EQ_LABEL: Record<number, string> = {
  80: 'Sub', 200: 'Warmth', 500: 'Body', 1200: 'Mids', 3000: 'Clarity', 6000: 'Presence', 12000: 'Air',
};
const WPM = 185; // Monroe's measured long-form pace (standing spec)

const PRESETS: { id: string; label: string; hint: string; post: DeepPartial<Post> }[] = [
  {
    id: 'warm',
    label: 'Warm & calm',
    hint: 'rounder low end, softer top, unhurried',
    post: {
      tempo: 0.9, pitch_semitones: -0.5, low_shelf_db: 2, high_shelf_db: -1,
      eq: { '80': 0, '200': 1.5, '500': 0.5, '1200': 0, '3000': -0.5, '6000': -1.5, '12000': -1 },
      compressor: { enabled: true, threshold_db: -20, ratio: 2.5, attack_ms: 25, release_ms: 300, makeup_db: 2 },
      highpass_hz: 70,
    },
  },
  {
    id: 'broadcast',
    label: 'Broadcast',
    hint: 'radio polish: tight lows, presence, levelled',
    post: {
      highpass_hz: 90, deess: 0.3, low_shelf_db: 1, high_shelf_db: 1.5,
      eq: { '80': 0, '200': 0, '500': -1, '1200': 0, '3000': 2, '6000': 1, '12000': 0.5 },
      compressor: { enabled: true, threshold_db: -18, ratio: 3, attack_ms: 15, release_ms: 200, makeup_db: 3 },
      loudnorm: { enabled: true, lufs: -16 },
    },
  },
  {
    id: 'intimate',
    label: 'Close mic',
    hint: 'closer, a touch of room, slower',
    post: {
      tempo: 0.88, low_shelf_db: 2.5, eq: { '80': 0, '200': 1, '500': 1, '1200': -0.5, '3000': 0, '6000': -1, '12000': -2 },
      room: { enabled: true, delay_ms: 30, decay: 0.18 },
      compressor: { enabled: true, threshold_db: -22, ratio: 2, attack_ms: 30, release_ms: 350, makeup_db: 2 },
    },
  },
];

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function deepMerge<T>(base: T, over: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over || {})) {
    const cur = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object') {
      out[k] = deepMerge(cur as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ─── tiny UI atoms ─────────────────────────────────────────────────────── */

function Tag({ live }: { live: boolean }): React.ReactElement {
  return (
    <span
      title={live ? 'Applies instantly to the current sample (no GPU)' : 'Needs a fresh sample (Modal, pennies)'}
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
        padding: '1px 6px', borderRadius: 999,
        background: live ? 'rgba(22,163,74,0.12)' : 'rgba(139,92,246,0.12)',
        color: live ? JELLY_TOKENS.success : JELLY_TOKENS.brand,
      }}
    >
      {live ? '⚡ live' : '● re-render'}
    </span>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
  disabled?: boolean;
}): React.ReactElement {
  const { t } = useTheme();
  const { label, value, min, max, step, onChange, fmt, hint, disabled } = props;
  return (
    <label style={{ display: 'block', opacity: disabled ? 0.45 : 1 }} title={hint}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textSecondary, marginBottom: 2 }}>
        <span style={{ color: t.text }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: JELLY_TOKENS.brand, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  const { t } = useTheme();
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.text, cursor: 'pointer' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: JELLY_TOKENS.brand }} />
      {label}
    </label>
  );
}

function Section({ title, live, children, right }: { title: string; live: boolean; children: React.ReactNode; right?: React.ReactNode }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div style={{ padding: 14, borderRadius: JELLY_TOKENS.radius.md, background: t.cardAlt, border: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: t.text }}>
          {title} <Tag live={live} />
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ─── main ──────────────────────────────────────────────────────────────── */

type SampleSlot = {
  id: string | null;
  status: VoicePreviewStatus | null;
  audioUrl: string | null;
  busy: boolean;
  err: string | null;
};
const EMPTY_SLOT: SampleSlot = { id: null, status: null, audioUrl: null, busy: false, err: null };

export function VoiceTuner(): React.ReactElement {
  const { t } = useTheme();
  const [voices, setVoices] = React.useState<VoiceRow[]>([]);
  const [voice, setVoice] = React.useState<string>('Monroe');
  const [doc, setDoc] = React.useState<VoiceTuningDoc | null>(null);
  const [draft, setDraft] = React.useState<VoiceTuning | null>(null);
  const [text, setText] = React.useState('');
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [draftSlot, setDraftSlot] = React.useState<SampleSlot>(EMPTY_SLOT);
  const [lockedSlot, setLockedSlot] = React.useState<SampleSlot>(EMPTY_SLOT);
  const [pendingLive, setPendingLive] = React.useState(false);
  const draftAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const draftGenAtRender = React.useRef<Gen | null>(null);
  const draftGapAtRender = React.useRef<number | null>(null);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3500);
  };

  // voices list
  React.useEffect(() => {
    let dead = false;
    fetch('/api/vater/voices')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { voices?: VoiceRow[] }) => {
        if (dead) return;
        const list = (j.voices || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        setVoices(list);
        if (list.length && !list.some((v) => v.name === 'Monroe')) setVoice(list[0].name);
      })
      .catch((e) => !dead && setLoadErr(`voices: ${e.message}`));
    return () => { dead = true; };
  }, []);

  // tuning doc for the selected voice
  const loadTuning = React.useCallback(async (name: string) => {
    setLoadErr(null);
    setDoc(null);
    setDraft(null);
    setDraftSlot(EMPTY_SLOT);
    setLockedSlot(EMPTY_SLOT);
    try {
      const r = await fetch(`/api/vater/voices/${encodeURIComponent(name)}/tuning`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as VoiceTuningDoc;
      setDoc(j);
      setDraft(clone(j.tuning));
      setText((prev) => prev || j.sampleText || '');
    } catch (e) {
      setLoadErr(`tuning: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);
  React.useEffect(() => { if (voice) void loadTuning(voice); }, [voice, loadTuning]);

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const estSec = Math.round((words / WPM) * 60 / (draft?.post.tempo || 1));
  const dirty = !!doc && !!draft && !same(draft, doc.tuning);
  const genStale =
    !!draft && !!draftSlot.id &&
    (!same(draft.gen, draftGenAtRender.current) || draft.post.chunk_gap_ms !== draftGapAtRender.current);

  /* ── sample rendering ─────────────────────────────────────────────── */
  const pollUntilDone = React.useCallback(async (pid: string): Promise<VoicePreviewStatus> => {
    for (let i = 0; i < 240; i++) {
      const r = await fetch(`/api/vater/voice-previews/${pid}`);
      if (!r.ok) throw new Error(`poll HTTP ${r.status}`);
      const s = (await r.json()) as VoicePreviewStatus;
      if (s.phase === 'done' || s.phase === 'error') return s;
      await new Promise((res) => setTimeout(res, 1500));
    }
    throw new Error('timed out waiting for the sample');
  }, []);

  const renderSample = React.useCallback(
    async (tuning: VoiceTuning, setSlot: React.Dispatch<React.SetStateAction<SampleSlot>>, remember: boolean) => {
      setSlot({ ...EMPTY_SLOT, busy: true });
      try {
        const r = await fetch(`/api/vater/voices/${encodeURIComponent(voice)}/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, gen: tuning.gen, post: tuning.post }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.detail || j.error || `HTTP ${r.status}`);
        }
        const { previewId } = (await r.json()) as { previewId: string };
        setSlot((s) => ({ ...s, id: previewId }));
        const done = await pollUntilDone(previewId);
        if (done.phase === 'error') throw new Error(done.error || 'sample failed');
        if (remember) {
          draftGenAtRender.current = clone(tuning.gen);
          draftGapAtRender.current = tuning.post.chunk_gap_ms;
        }
        setSlot({
          id: previewId, status: done, busy: false, err: null,
          audioUrl: `/api/vater/voice-previews/${previewId}/audio?v=${done.v || 1}&_=${Date.now()}`,
        });
      } catch (e) {
        setSlot((s) => ({ ...s, busy: false, err: e instanceof Error ? e.message : String(e) }));
      }
    },
    [voice, text, pollUntilDone],
  );

  // Progress line while Modal works on the draft sample.
  const [liveStatus, setLiveStatus] = React.useState<VoicePreviewStatus | null>(null);
  React.useEffect(() => {
    if (!draftSlot.busy || !draftSlot.id) { setLiveStatus(null); return; }
    let dead = false;
    const id = draftSlot.id;
    const h = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/vater/voice-previews/${id}`);
        if (r.ok && !dead) setLiveStatus((await r.json()) as VoicePreviewStatus);
      } catch { /* ignore */ }
    }, 3000);
    return () => { dead = true; window.clearInterval(h); };
  }, [draftSlot.busy, draftSlot.id]);

  /* ── live post re-apply (debounced) ───────────────────────────────── */
  const postSig = JSON.stringify(draft?.post ?? null);
  const lastAppliedPost = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!draft || !draftSlot.id || draftSlot.busy || draftSlot.status?.phase !== 'done') return;
    if (lastAppliedPost.current === null) { lastAppliedPost.current = postSig; return; }
    if (lastAppliedPost.current === postSig) return;
    setPendingLive(true);
    const pid = draftSlot.id;
    const post = draft.post;
    const h = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/vater/voice-previews/${pid}/post`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ post }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const s = (await r.json()) as VoicePreviewStatus;
        lastAppliedPost.current = JSON.stringify(post);
        const el = draftAudioRef.current;
        const wasPlaying = !!el && !el.paused;
        const at = el?.currentTime || 0;
        setDraftSlot((cur) => ({
          ...cur, status: s,
          audioUrl: `/api/vater/voice-previews/${pid}/audio?v=${s.v || 1}&_=${Date.now()}`,
        }));
        // resume where the ear was
        window.setTimeout(() => {
          const a = draftAudioRef.current;
          if (a && wasPlaying) { a.currentTime = Math.min(at, Math.max(0, (s.durationS || at) - 0.2)); void a.play().catch(() => {}); }
        }, 250);
      } catch (e) {
        flash(`live re-process failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setPendingLive(false);
      }
    }, 450);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postSig, draftSlot.id, draftSlot.busy, draftSlot.status?.phase]);
  React.useEffect(() => { lastAppliedPost.current = null; }, [draftSlot.id]);

  /* ── mutations ────────────────────────────────────────────────────── */
  const upd = (patch: DeepPartial<VoiceTuning>) =>
    setDraft((d) => (d ? deepMerge(d, patch) : d));
  const setGen = (k: keyof Gen, v: number | null) => upd({ gen: { [k]: v } as DeepPartial<Gen> });
  const setPost = (k: keyof Post, v: unknown) => upd({ post: { [k]: v } as DeepPartial<Post> });

  const lockIn = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/vater/voices/${encodeURIComponent(voice)}/tuning`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tuning: draft }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail || j.error || `HTTP ${r.status}`); }
      const j = (await r.json()) as VoiceTuningDoc;
      setDoc((d) => (d ? { ...d, tuning: j.tuning, locked: true, updatedAt: j.updatedAt, chain: j.chain } : j));
      setDraft(clone(j.tuning));
      setLockedSlot(EMPTY_SLOT);
      flash(`🔒 ${voice} locked in — every render uses these settings now.`);
    } catch (e) {
      flash(`lock failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  };

  const factoryReset = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/vater/voices/${encodeURIComponent(voice)}/tuning`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as VoiceTuningDoc;
      setDoc((d) => (d ? { ...d, tuning: j.tuning, locked: false, updatedAt: null } : d));
      setDraft(clone(j.tuning));
      setLockedSlot(EMPTY_SLOT);
      flash(`${voice} back to factory defaults (env pacing, no EQ).`);
    } catch (e) {
      flash(`reset failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  };

  /* ── render ───────────────────────────────────────────────────────── */
  const card: React.CSSProperties = {
    padding: 16, borderRadius: JELLY_TOKENS.radius.lg, background: t.card, border: `1px solid ${t.border}`,
  };
  const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5 };
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px 18px' };

  const statusLine = (slot: SampleSlot, live: VoicePreviewStatus | null) => {
    if (slot.err) return <span style={{ color: JELLY_TOKENS.error }}>✗ {slot.err}</span>;
    if (slot.busy) {
      const s = live || slot.status;
      const ph = s?.phase;
      const msg = !s || ph === 'queued' ? 'queued on Modal (cold start can take ~60s)…'
        : ph === 'synth' ? `speaking… chunk ${s.chunkDone ?? 0}/${s.chunks ?? '?'}`
        : ph === 'post' ? 'applying EQ chain…' : 'working…';
      return <span>⏳ {msg}</span>;
    }
    if (slot.status?.phase === 'done') {
      const s = slot.status;
      return (
        <span>
          ✓ {s.durationS?.toFixed(1)}s sample · Modal {s.modalWallS?.toFixed(0)}s · ${(s.usd ?? 0).toFixed(3)}
          {pendingLive ? ' · ⚡ re-processing…' : ''}
        </span>
      );
    }
    return <span>no sample yet</span>;
  };

  return (
    <div style={card}>
      {/* header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>🎛 Voice Tuner</div>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          style={{
            fontSize: 12, padding: '4px 8px', borderRadius: JELLY_TOKENS.radius.sm,
            border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text,
          }}
        >
          {/* The value is the wire id (namespaced for a user's own clone); the
              label is the stem, because "u_cm3x…~Mom" is plumbing. */}
          {(voices.length ? voices : [{ name: voice }]).map((v) => (
            <option key={v.name} value={v.name}>
              {voiceDisplayName(v.name)}
              {isSharedVoiceId(v.name) ? '' : ' (yours)'}
            </option>
          ))}
        </select>
        {doc && (
          <span style={{
            fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
            background: doc.locked ? 'rgba(22,163,74,0.12)' : t.hover,
            color: doc.locked ? JELLY_TOKENS.success : t.textSecondary,
          }}>
            {doc.locked
              ? `🔒 locked ${doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : ''}`
              : 'using defaults (env pacing, no EQ)'}
          </span>
        )}
        {dirty && <span style={{ fontSize: 10.5, color: JELLY_TOKENS.warning }}>● unsaved changes</span>}
        <span style={{ flex: 1 }} />
        {toast && <span style={{ fontSize: 11, color: t.text }}>{toast}</span>}
      </div>
      <p style={{ fontSize: 11, color: t.textSecondary, margin: '0 0 12px', lineHeight: 1.5 }}>
        Shape how a voice reads, hear a ~30s sample of exactly what renders will produce, then lock it in.
        <strong> ⚡ live</strong> knobs re-process the sample in ~2s; <strong>● re-render</strong> knobs need a fresh
        sample (Modal L40S, ≈ $0.01–0.03; first one after idle takes ~60s to warm).
      </p>

      {loadErr && <div style={{ color: JELLY_TOKENS.error, fontSize: 12, marginBottom: 10 }}>{loadErr}</div>}

      {draft && doc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* sample text */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textSecondary, marginBottom: 4 }}>
              <span style={{ color: t.text, fontWeight: 600 }}>Sample text</span>
              <span>
                {words} words · ≈ {estSec}s at {WPM} wpm{' '}
                <button
                  type="button"
                  onClick={() => setText(doc.sampleText || '')}
                  style={{ background: 'none', border: 'none', color: JELLY_TOKENS.brand, cursor: 'pointer', fontSize: 11, padding: 0 }}
                >reset text</button>
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: 12.5, lineHeight: 1.5, padding: 8,
                borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text,
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </div>

          {/* players */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${JELLY_TOKENS.brandOutline}`, background: JELLY_TOKENS.brandGhost }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>A · Draft (what you&apos;re editing)</span>
                <span style={{ flex: 1 }} />
                <VBtn size="sm" variant="primary" disabled={draftSlot.busy || words < 3} onClick={() => void renderSample(draft, setDraftSlot, true)}>
                  {draftSlot.busy ? 'Rendering…' : draftSlot.id ? (genStale ? '● Re-render sample' : 'Render again') : '▶ Render sample'}
                </VBtn>
              </div>
              {draftSlot.audioUrl && (
                <audio ref={draftAudioRef} controls src={draftSlot.audioUrl} style={{ width: '100%', height: 34 }} />
              )}
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6 }}>
                {statusLine(draftSlot, liveStatus)}
                {genStale && !draftSlot.busy && (
                  <span style={{ color: JELLY_TOKENS.warning }}> · delivery/emotion changed → re-render to hear it</span>
                )}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${t.border}`, background: t.cardAlt }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>B · {doc.locked ? 'Locked settings' : 'Current defaults'}</span>
                <span style={{ flex: 1 }} />
                <VBtn size="sm" variant="outlined" disabled={lockedSlot.busy || words < 3} onClick={() => void renderSample(doc.tuning, setLockedSlot, false)}>
                  {lockedSlot.busy ? 'Rendering…' : 'Hear for A/B'}
                </VBtn>
              </div>
              {lockedSlot.audioUrl && <audio controls src={lockedSlot.audioUrl} style={{ width: '100%', height: 34 }} />}
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6 }}>{statusLine(lockedSlot, null)}</div>
            </div>
          </div>

          {/* presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: t.textSecondary }}>Starting points:</span>
            {PRESETS.map((p) => (
              <button
                key={p.id} type="button" title={p.hint}
                onClick={() => upd({ post: deepMerge(doc.defaults?.post ?? draft.post, { ...p.post, chunk_gap_ms: draft.post.chunk_gap_ms }) })}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${t.border}`, background: t.cardAlt, color: t.text,
                }}
              >{p.label}</button>
            ))}
            <button
              type="button" title="Zero every EQ/post knob (keeps pacing)"
              onClick={() => doc.defaults && upd({ post: { ...clone(doc.defaults.post), tempo: draft.post.tempo, chunk_gap_ms: draft.post.chunk_gap_ms } })}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary }}
            >Flat EQ</button>
          </div>

          {/* PACE */}
          <Section title="Pace & pauses" live={false}
            right={<span style={{ fontSize: 10.5, color: t.textSecondary }}>tempo is ⚡ live; pauses need a re-render</span>}>
            <div style={grid2}>
              <Slider label="Tempo (pitch-safe) ⚡" value={draft.post.tempo} min={0.7} max={1.25} step={0.01}
                fmt={(v) => `${v.toFixed(2)}× · ≈${Math.round(WPM * v)} wpm`} onChange={(v) => setPost('tempo', v)}
                hint="Below 1.0 slows the read without changing pitch. Monroe locked at 0.92 today." />
              <Slider label="Pause between sentences ●" value={draft.gen.interval_silence_ms} min={0} max={1200} step={10}
                fmt={(v) => `${v} ms`} onChange={(v) => setGen('interval_silence_ms', v)}
                hint="IndexTTS-2 interval_silence — the breath the engine puts between its own segments." />
              <Slider label="Breath between chunks ●" value={draft.post.chunk_gap_ms} min={0} max={1500} step={10}
                fmt={(v) => `${v} ms`} onChange={(v) => setPost('chunk_gap_ms', v)}
                hint="Real silence welded between ~90-word chunks (sentence boundaries)." />
            </div>
          </Section>

          {/* DELIVERY */}
          <Section title="Delivery (sampler)" live={false}>
            <div style={grid2}>
              <Slider label="Temperature" value={draft.gen.temperature} min={0.1} max={1.5} step={0.05} fmt={(v) => v.toFixed(2)}
                onChange={(v) => setGen('temperature', v)} hint="Lower = steadier, more predictable read. Higher = more variation (and more risk of slips)." />
              <Slider label="Top-p" value={draft.gen.top_p} min={0.1} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => setGen('top_p', v)} />
              <Slider label="Top-k" value={draft.gen.top_k} min={1} max={100} step={1} onChange={(v) => setGen('top_k', v)} />
              <Slider label="Beams" value={draft.gen.num_beams} min={1} max={6} step={1} onChange={(v) => setGen('num_beams', v)}
                hint="More beams = more careful, slower to synthesize." />
              <Slider label="Repetition penalty" value={draft.gen.repetition_penalty} min={1} max={20} step={0.5} fmt={(v) => v.toFixed(1)}
                onChange={(v) => setGen('repetition_penalty', v)} />
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 11, color: t.text, marginBottom: 2 }}>Seed <span style={{ color: t.textSecondary }}>(blank = random each take)</span></div>
                <input
                  type="number" value={draft.gen.seed ?? ''} placeholder="random"
                  onChange={(e) => setGen('seed', e.target.value === '' ? null : Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '4px 8px', borderRadius: JELLY_TOKENS.radius.sm, border: `1px solid ${t.border}`, background: t.card, color: t.text }}
                />
              </label>
            </div>
          </Section>

          {/* EMOTION */}
          <Section title="Emotion" live={false}
            right={<span style={{ fontSize: 10.5, color: t.textSecondary }}>all zero = the reference clip&apos;s own feel</span>}>
            <div style={{ marginBottom: 8 }}>
              <Slider label="Emotion strength (alpha)" value={draft.gen.emo_alpha} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)}
                onChange={(v) => setGen('emo_alpha', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px 14px' }}>
              {EMO_KEYS.map((k) => (
                <Slider key={k} label={k} value={draft.gen.emo[k] ?? 0} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)}
                  onChange={(v) => upd({ gen: { emo: { ...draft.gen.emo, [k]: v } } })} />
              ))}
            </div>
          </Section>

          {/* EQ */}
          <Section title="Tone · equalizer" live>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${EQ_BANDS.length}, 1fr)`, gap: 6, marginBottom: 12 }}>
              {EQ_BANDS.map((hz) => {
                const v = draft.post.eq[String(hz)] ?? 0;
                return (
                  <div key={hz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10.5, color: v ? t.text : t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                      {v > 0 ? '+' : ''}{v.toFixed(1)} dB
                    </span>
                    <input
                      type="range" min={-12} max={12} step={0.5} value={v}
                      onChange={(e) => upd({ post: { eq: { ...draft.post.eq, [String(hz)]: Number(e.target.value) } } })}
                      onDoubleClick={() => upd({ post: { eq: { ...draft.post.eq, [String(hz)]: 0 } } })}
                      style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 120, width: 24, accentColor: JELLY_TOKENS.brand, cursor: 'pointer' }}
                      title={`${EQ_LABEL[hz]} · ${hz} Hz (double-click to zero)`}
                    />
                    <span style={{ fontSize: 10.5, color: t.text, fontWeight: 600 }}>{EQ_LABEL[hz]}</span>
                    <span style={{ fontSize: 9.5, color: t.textSecondary }}>{hz >= 1000 ? `${hz / 1000}k` : hz} Hz</span>
                  </div>
                );
              })}
            </div>
            <div style={grid2}>
              <Slider label="Warmth (low shelf 200 Hz)" value={draft.post.low_shelf_db} min={-12} max={12} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`} onChange={(v) => setPost('low_shelf_db', v)} />
              <Slider label="Air (high shelf 5 kHz)" value={draft.post.high_shelf_db} min={-12} max={12} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`} onChange={(v) => setPost('high_shelf_db', v)} />
              <Slider label="Pitch" value={draft.post.pitch_semitones} min={-6} max={6} step={0.25} fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} st`} onChange={(v) => setPost('pitch_semitones', v)}
                hint="Semitones, formant-aware (rubberband). Small moves (±0.5–1) read as a different person; keep it subtle." />
              <Slider label="High-pass (rumble cut)" value={draft.post.highpass_hz} min={0} max={300} step={5} fmt={(v) => (v ? `${v} Hz` : 'off')} onChange={(v) => setPost('highpass_hz', v)} />
              <Slider label="Low-pass (dull the top)" value={draft.post.lowpass_hz} min={0} max={16000} step={250} fmt={(v) => (v ? `${(v / 1000).toFixed(1)} kHz` : 'off')}
                onChange={(v) => setPost('lowpass_hz', v)} />
            </div>
          </Section>

          {/* DYNAMICS */}
          <Section title="Dynamics & polish" live>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 10 }}>
              <Toggle label="Compressor" on={draft.post.compressor.enabled} onChange={(v) => upd({ post: { compressor: { enabled: v } } })} />
              <Toggle label="Room (tiny echo)" on={draft.post.room.enabled} onChange={(v) => upd({ post: { room: { enabled: v } } })} />
              <Toggle label="Loudness normalize" on={draft.post.loudnorm.enabled} onChange={(v) => upd({ post: { loudnorm: { enabled: v } } })} />
            </div>
            <div style={grid2}>
              <Slider label="Comp · threshold" disabled={!draft.post.compressor.enabled} value={draft.post.compressor.threshold_db} min={-50} max={0} step={1} fmt={(v) => `${v} dB`} onChange={(v) => upd({ post: { compressor: { threshold_db: v } } })} />
              <Slider label="Comp · ratio" disabled={!draft.post.compressor.enabled} value={draft.post.compressor.ratio} min={1} max={12} step={0.5} fmt={(v) => `${v.toFixed(1)}:1`} onChange={(v) => upd({ post: { compressor: { ratio: v } } })} />
              <Slider label="Comp · attack" disabled={!draft.post.compressor.enabled} value={draft.post.compressor.attack_ms} min={1} max={200} step={1} fmt={(v) => `${v} ms`} onChange={(v) => upd({ post: { compressor: { attack_ms: v } } })} />
              <Slider label="Comp · release" disabled={!draft.post.compressor.enabled} value={draft.post.compressor.release_ms} min={20} max={1500} step={10} fmt={(v) => `${v} ms`} onChange={(v) => upd({ post: { compressor: { release_ms: v } } })} />
              <Slider label="Comp · makeup gain" disabled={!draft.post.compressor.enabled} value={draft.post.compressor.makeup_db} min={0} max={18} step={0.5} fmt={(v) => `+${v.toFixed(1)} dB`} onChange={(v) => upd({ post: { compressor: { makeup_db: v } } })} />
              <Slider label="De-ess (tame S sounds)" value={draft.post.deess} min={0} max={1} step={0.05} fmt={(v) => (v ? v.toFixed(2) : 'off')} onChange={(v) => setPost('deess', v)} />
              <Slider label="Denoise" value={draft.post.denoise} min={0} max={1} step={0.05} fmt={(v) => (v ? v.toFixed(2) : 'off')} onChange={(v) => setPost('denoise', v)} />
              <Slider label="Room · size" disabled={!draft.post.room.enabled} value={draft.post.room.delay_ms} min={5} max={200} step={5} fmt={(v) => `${v} ms`} onChange={(v) => upd({ post: { room: { delay_ms: v } } })} />
              <Slider label="Room · decay" disabled={!draft.post.room.enabled} value={draft.post.room.decay} min={0} max={0.9} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => upd({ post: { room: { decay: v } } })} />
              <Slider label="Target loudness" disabled={!draft.post.loudnorm.enabled} value={draft.post.loudnorm.lufs} min={-24} max={-10} step={0.5} fmt={(v) => `${v} LUFS`} onChange={(v) => upd({ post: { loudnorm: { lufs: v } } })} />
              <Slider label="Gain (when not normalizing)" disabled={draft.post.loudnorm.enabled} value={draft.post.gain_db} min={-12} max={12} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`} onChange={(v) => setPost('gain_db', v)} />
            </div>
          </Section>

          {/* footer */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <VBtn variant="accent" size="md" disabled={saving || !dirty} onClick={() => void lockIn()}>
              {saving ? 'Saving…' : `🔒 Lock in for ${voice}`}
            </VBtn>
            <VBtn variant="outlined" size="sm" disabled={saving || !dirty} onClick={() => setDraft(clone(doc.tuning))}>
              Revert to {doc.locked ? 'locked' : 'defaults'}
            </VBtn>
            <VBtn variant="text" size="sm" disabled={saving || !doc.locked} onClick={() => void factoryReset()}>
              Unlock → factory defaults
            </VBtn>
            <span style={{ flex: 1 }} />
            <span style={{ ...mono, color: t.textSecondary, maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={draftSlot.status?.chain || doc.chain || ''}>
              chain: {draftSlot.status?.chain || doc.chain || '(none)'}
            </span>
          </div>
          <p style={{ fontSize: 10.5, color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>
            Locking writes <code style={mono}>vater_voices/{voice}.tuning.json</code> on the DGX. Every render that narrates with {voice}
            (IndexTTS-2 on Modal) applies the same generation settings and the same ffmpeg chain you just heard — no re-deploy, takes
            effect on the next job. Unlocked voices keep today&apos;s behaviour (VATER-SETTINGS.env pacing, no EQ).
          </p>
        </div>
      )}
      {!draft && !loadErr && <div style={{ fontSize: 12, color: t.textSecondary }}>Loading {voice}…</div>}
    </div>
  );
}
