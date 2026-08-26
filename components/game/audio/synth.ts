/**
 * Web Audio chiptune: oscillators + filtered noise for SFX, a lookahead
 * sequencer for music. Zero audio files. Unlocks only from a user gesture.
 */
import type { MusicId, SfxName } from "../engine/types";

type Wave = OscillatorType;

interface NoteOpts {
  when?: number;
  slideTo?: number;
  bus?: "sfx" | "music";
  attack?: number;
  release?: number;
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteFreq(token: string): number {
  // "C4", "F#3", "Bb2"
  const m = /^([A-G])([#b]?)(\d)$/.exec(token);
  if (!m) return 0;
  let n = NOTE_INDEX[m[1]];
  if (m[2] === "#") n++;
  if (m[2] === "b") n--;
  const oct = Number(m[3]);
  const midi = 12 * (oct + 1) + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class Synth {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  unlocked = false;
  private unlocking = false;

  /** Call from a user gesture only. Safe to call repeatedly. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (this.unlocking) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.unlocking = true;
    try {
      if (!this.ctx) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.32;
        this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.55;
        this.sfxBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      // iOS: play a silent buffer inside the gesture, then resume.
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      void this.ctx.resume().then(() => {
        this.unlocked = this.ctx?.state === "running";
      });
      this.unlocked = this.ctx.state === "running";
    } catch {
      /* no audio — game still plays */
    } finally {
      this.unlocking = false;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().then(() => (this.unlocked = true));
  }

  state(): string {
    return this.ctx ? this.ctx.state : "none";
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  playNote(freq: number, dur: number, type: Wave, vol: number, o: NoteOpts = {}): void {
    const c = this.ctx;
    if (!c || !this.sfxBus || !this.musicBus || freq <= 0) return;
    const when = o.when ?? c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), when + dur);
    const a = o.attack ?? 0.005;
    const r = o.release ?? Math.min(0.08, dur * 0.5);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + a);
    g.gain.setValueAtTime(vol, Math.max(when + a, when + dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(o.bus === "music" ? this.musicBus : this.sfxBus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  noise(dur: number, vol: number, filterHz: number, o: NoteOpts = {}): void {
    const c = this.ctx;
    if (!c || !this.noiseBuf || !this.sfxBus || !this.musicBus) return;
    const when = o.when ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filterHz > 3000 ? "highpass" : "lowpass";
    f.frequency.value = filterHz;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus === "music" ? this.musicBus : this.sfxBus);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ctx) return;
    SFX[name](this);
  }
}

const SFX: Record<SfxName, (s: Synth) => void> = {
  jump: (s) => s.playNote(300, 0.14, "square", 0.25, { slideTo: 620 }),
  ultraCharge: (s) => s.playNote(120, 0.5, "sawtooth", 0.12, { slideTo: 480 }),
  ultra: (s) => {
    s.playNote(200, 0.35, "square", 0.3, { slideTo: 1400 });
    s.noise(0.25, 0.2, 1800);
  },
  bash: (s) => {
    s.noise(0.12, 0.35, 900);
    s.playNote(160, 0.1, "square", 0.2, { slideTo: 60 });
  },
  crack: (s) => {
    s.noise(0.2, 0.4, 2400);
    s.playNote(900, 0.15, "triangle", 0.2, { slideTo: 300 });
  },
  coin: (s) => {
    s.playNote(1046, 0.08, "square", 0.18);
    s.playNote(1568, 0.16, "square", 0.18, { when: s.now + 0.07 });
  },
  hit: (s) => {
    s.playNote(220, 0.25, "sawtooth", 0.25, { slideTo: 60 });
    s.noise(0.2, 0.25, 600);
  },
  boing: (s) => s.playNote(180, 0.25, "sine", 0.3, { slideTo: 900 }),
  portal: (s) => {
    for (let i = 0; i < 8; i++) s.playNote(220 * Math.pow(1.25, i), 0.16, "triangle", 0.16, { when: s.now + i * 0.06 });
    s.noise(0.7, 0.12, 2600);
  },
  powerup: (s) => {
    const seq = [523, 659, 784, 1046, 1318];
    seq.forEach((f, i) => s.playNote(f, 0.14, "square", 0.2, { when: s.now + i * 0.08 }));
  },
  roar: (s) => {
    s.playNote(90, 0.6, "sawtooth", 0.3, { slideTo: 50 });
    s.noise(0.5, 0.3, 400);
  },
  whistle: (s) => s.playNote(600, 1.0, "sine", 0.25, { slideTo: 1400, attack: 0.1 }),
  boost: (s) => {
    s.playNote(240, 0.3, "square", 0.25, { slideTo: 1100 });
    s.noise(0.15, 0.15, 3000);
  },
  respawn: (s) => {
    s.playNote(400, 0.12, "triangle", 0.2, { slideTo: 800 });
    s.playNote(800, 0.2, "triangle", 0.2, { when: s.now + 0.12 });
  },
  splash: (s) => {
    s.noise(0.35, 0.3, 1200);
    s.playNote(500, 0.2, "sine", 0.15, { slideTo: 150 });
  },
  victory: (s) => {
    const seq = [523, 523, 523, 659, 784, 1046];
    seq.forEach((f, i) => s.playNote(f, i === 5 ? 0.6 : 0.14, "square", 0.22, { when: s.now + i * 0.13 }));
  },
  select: (s) => s.playNote(880, 0.07, "square", 0.15),
  stomp: (s) => {
    s.playNote(500, 0.1, "square", 0.25, { slideTo: 120 });
    s.noise(0.1, 0.2, 800);
  },
  freeze: (s) => {
    s.playNote(1800, 0.3, "sine", 0.18, { slideTo: 600 });
    s.noise(0.3, 0.12, 5000);
  },
  pop: (s) => s.playNote(700, 0.06, "square", 0.2, { slideTo: 200 }),
};

/* ── music ─────────────────────────────────────────────────────────────── */
interface Pattern {
  bpm: number;
  leadType: Wave;
  bassType: Wave;
  /** 16-step bars; tokens: note ("C4"), "-" sustain, "." rest */
  lead: string[];
  bass: string[];
  /** k=kick s=snare h=hat .=rest */
  drums: string;
  leadVol?: number;
}

const P = (bpm: number, leadType: Wave, bassType: Wave, lead: string[], bass: string[], drums: string, leadVol = 0.16): Pattern => ({
  bpm,
  leadType,
  bassType,
  lead,
  bass,
  drums,
  leadVol,
});

export const PATTERNS: Record<MusicId, Pattern | null> = {
  none: null,
  title: P(
    112,
    "triangle",
    "triangle",
    ["C5 . E5 . G5 . E5 . A5 - G5 . E5 . D5 .", "C5 . E5 . G5 . C6 . B5 - G5 . E5 . G5 -"],
    ["C3 . . . G2 . . . A2 . . . G2 . . .", "F2 . . . G2 . . . C3 . . . G2 . . ."],
    "k . h . s . h . k . h . s . h h",
  ),
  factory: P(
    140,
    "square",
    "square",
    ["E4 E4 . G4 E4 . A4 . G4 . E4 . D4 . E4 .", "E4 E4 . G4 B4 . A4 . G4 . E4 D4 E4 . . ."],
    ["E2 . E2 . E2 . E2 . D2 . D2 . D2 . D2 .", "E2 . E2 . G2 . G2 . A2 . A2 . B2 . B2 ."],
    "k . h h s . h . k k h . s . h h",
  ),
  star: P(
    110,
    "triangle",
    "sine",
    ["C5 E5 G5 C6 . G5 E5 C5 A4 C5 E5 A5 . E5 C5 A4", "F4 A4 C5 F5 . C5 A4 F4 G4 B4 D5 G5 . D5 B4 G4"],
    ["C3 . . . C3 . . . A2 . . . A2 . . .", "F2 . . . F2 . . . G2 . . . G2 . . ."],
    ". . h . k . h . . . h . k . h .",
    0.13,
  ),
  falling: P(
    150,
    "square",
    "triangle",
    ["A5 G5 F5 E5 D5 C5 B4 A4 G4 F4 E4 D4 C4 . . .", "A5 . E5 . C5 . A4 . G4 . D4 . B3 . . ."],
    ["A2 . . . A2 . . . F2 . . . G2 . . .", "A2 . . . E2 . . . F2 . . . G2 . . ."],
    "k . . . k . h . k . . . s . h h",
  ),
  water: P(
    90,
    "sine",
    "sine",
    ["E5 - . G5 - . B5 - - . G5 - E5 - . .", "D5 - . F5 - . A5 - - . F5 - D5 - . ."],
    ["E2 . . . . . B2 . . . . . E2 . . .", "D2 . . . . . A2 . . . . . D2 . . ."],
    ". . . h . . . h . . . h . . . h",
    0.14,
  ),
  pipes: P(
    128,
    "square",
    "square",
    ["G4 . G4 . B4 . D5 . G4 . G4 . F4 . D4 .", "G4 . G4 . B4 . D5 . E5 . D5 . B4 . G4 ."],
    ["G2 . . G2 . . G2 . F2 . . F2 . . F2 .", "G2 . . G2 . . G2 . C3 . . C3 . . D3 ."],
    "k . h . s . h . k . h . s . h .",
  ),
  bouncy: P(
    160,
    "square",
    "triangle",
    ["C4 C5 C4 C5 E4 E5 E4 E5 G4 G5 G4 G5 E4 E5 C4 C5", "F4 F5 F4 F5 A4 A5 A4 A5 G4 G5 G4 G5 B4 B5 G4 G5"],
    ["C2 . C3 . C2 . C3 . G2 . G3 . G2 . G3 .", "F2 . F3 . F2 . F3 . G2 . G3 . G2 . G3 ."],
    "k h s h k h s h k h s h k h s h",
  ),
  danger: P(
    150,
    "sawtooth",
    "square",
    ["E4 . Bb4 . E4 . Bb4 . E4 Bb4 E5 . Bb4 . E4 .", "F4 . B4 . F4 . B4 . F4 B4 F5 . B4 . F4 ."],
    ["E2 E2 . E2 . E2 E2 . E2 . E2 E2 . E2 . .", "F2 F2 . F2 . F2 F2 . F2 . F2 F2 . F2 . ."],
    "k . k . s . . . k . k . s . h h",
    0.12,
  ),
  candy: P(
    130,
    "square",
    "triangle",
    ["C5 . E5 . G5 . E5 . F5 . A5 . G5 . E5 .", "D5 . F5 . A5 . F5 . G5 . B5 . C6 - . ."],
    ["C3 . G2 . C3 . G2 . F2 . C3 . F2 . C3 .", "G2 . D3 . G2 . D3 . C3 . G2 . C3 . . ."],
    "k . h . s . h . k . h . s . h h",
  ),
  dark: P(
    80,
    "triangle",
    "sine",
    ["A3 . . . . . C4 . . . . . B3 . . .", ". . . E4 . . . . . . D4 . . . . ."],
    ["A1 . . . . . . . . . . . . . . .", "E2 . . . . . . . . . . . . . . ."],
    ". . . . . . . h . . . . . . . .",
    0.14,
  ),
  boss: P(
    155,
    "sawtooth",
    "square",
    ["D4 . D4 . F4 . D4 . Ab4 . G4 . F4 . D4 .", "D4 . D4 . F4 . A4 . C5 . Bb4 . A4 . F4 ."],
    ["D2 D2 . D2 . D2 D2 . D2 . D2 D2 . D2 . D2", "Bb1 Bb1 . Bb1 . C2 C2 . C2 . D2 D2 . D2 . ."],
    "k . k . s . h . k . k . s . s s",
    0.12,
  ),
  finale: P(
    132,
    "square",
    "triangle",
    ["C5 . C5 . C5 . E5 . G5 - - . E5 . G5 .", "C6 - - . G5 . E5 . F5 . A5 . G5 - - ."],
    ["C3 . C3 . C3 . C3 . G2 . G2 . G2 . G2 .", "F2 . F2 . F2 . F2 . G2 . G2 . C3 . . ."],
    "k . h . s . h . k . h . s . h h",
  ),
};

export class Sequencer {
  private synth: Synth;
  private current: MusicId = "none";
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  constructor(synth: Synth) {
    this.synth = synth;
  }

  play(id: MusicId): void {
    if (id === this.current) return;
    this.current = id;
    this.step = 0;
    this.nextTime = this.synth.now + 0.05;
    if (this.timer === null && typeof window !== "undefined") {
      this.timer = window.setInterval(() => this.tick(), 25);
    }
  }

  stop(): void {
    this.current = "none";
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const s = this.synth;
    if (!s.ctx || s.ctx.state !== "running") return;
    const pat = PATTERNS[this.current];
    if (!pat) return;
    const stepDur = 60 / pat.bpm / 4;
    const now = s.now;
    if (this.nextTime < now - 0.5) this.nextTime = now + 0.02; // resync after a stall
    while (this.nextTime < now + 0.12) {
      this.schedule(pat, this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % (pat.lead.length * 16);
      this.nextTime += stepDur;
    }
  }

  private schedule(pat: Pattern, step: number, when: number, stepDur: number): void {
    const s = this.synth;
    const bar = Math.floor(step / 16);
    const i = step % 16;
    const leadTokens = pat.lead[bar % pat.lead.length].split(" ");
    const bassTokens = pat.bass[bar % pat.bass.length].split(" ");
    const drumTokens = pat.drums.split(" ");
    const lead = leadTokens[i] ?? ".";
    const bass = bassTokens[i] ?? ".";
    const drum = drumTokens[i] ?? ".";
    const len = (tokens: string[], idx: number) => {
      let n = 1;
      while (tokens[idx + n] === "-") n++;
      return n;
    };
    if (lead !== "." && lead !== "-") s.playNote(noteFreq(lead), stepDur * len(leadTokens, i) * 0.95, pat.leadType, pat.leadVol ?? 0.16, { when, bus: "music" });
    if (bass !== "." && bass !== "-") s.playNote(noteFreq(bass), stepDur * len(bassTokens, i) * 0.9, pat.bassType, 0.2, { when, bus: "music" });
    if (drum === "k") s.playNote(120, 0.12, "sine", 0.35, { when, slideTo: 40, bus: "music" });
    else if (drum === "s") s.noise(0.09, 0.22, 1800, { when, bus: "music" });
    else if (drum === "h") s.noise(0.04, 0.08, 6000, { when, bus: "music" });
  }
}
