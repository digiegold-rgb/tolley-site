/**
 * MusicPlayer — looping soundtrack tracks (public/game/music/{id}.ogg|.m4a, built by scripts/game/build-music.py)
 * through the Synth's music bus, with the original Sequencer patterns as the fallback when a track is missing
 * or audio decoding fails. Two lanes crossfade between worlds.
 */
import type { Sequencer, Synth } from "../audio/synth";
import type { MusicId } from "../engine/types";

type Lane = { source: AudioBufferSourceNode; gain: GainNode };
const FADE = 1.2;

export class MusicPlayer {
  current: MusicId = "none";
  mode: "file" | "synth" | "off" = "off";
  private files = new Map<string, Promise<ArrayBuffer | null>>();
  private decoded = new Map<string, AudioBuffer>();
  private lane: Lane | null = null;
  private generation = 0;
  private ext: "ogg" | "m4a" | null = null;
  constructor(
    private synth: Synth,
    private fallback: Sequencer,
  ) {}
  private extension() {
    if (this.ext) return this.ext;
    let ogg = true;
    try {
      ogg = typeof document !== "undefined" && document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"') !== "";
    } catch {}
    this.ext = ogg ? "ogg" : "m4a";
    return this.ext;
  }
  /** Fetch (and cache) the encoded file; null when the track does not exist. Safe before audio is unlocked. */
  preload(id: string) {
    if (!this.files.has(id)) {
      this.files.set(
        id,
        (async () => {
          try {
            const res = await fetch(`/game/music/${id}.${this.extension()}`, { cache: "force-cache" });
            if (!res.ok) return null;
            return await res.arrayBuffer();
          } catch {
            return null;
          }
        })(),
      );
    }
    return this.files.get(id)!;
  }
  private async buffer(id: string) {
    const ready = this.decoded.get(id);
    if (ready) return ready;
    const file = await this.preload(id);
    const ctx = this.synth.ctx;
    if (!file || !ctx) return null;
    try {
      const buf = await ctx.decodeAudioData(file.slice(0));
      this.decoded.set(id, buf);
      return buf;
    } catch {
      return null;
    }
  }
  play(id: MusicId) {
    if (id === this.current && this.mode !== "off") return;
    this.current = id;
    const gen = ++this.generation;
    if (id === "none") {
      this.stop();
      return;
    }
    // Keep something playing immediately; the real track takes over once decoded.
    void this.buffer(id).then((buf) => {
      if (gen !== this.generation) return;
      const ctx = this.synth.ctx,
        out = this.synth.musicOut;
      if (!buf || !ctx || !out) {
        this.fadeLane(0.3);
        this.fallback.play(id);
        this.mode = "synth";
        return;
      }
      this.fallback.stop();
      this.fadeLane(FADE);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(out);
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      source.connect(gain);
      source.start();
      gain.gain.setTargetAtTime(0.85, ctx.currentTime, FADE / 3);
      this.lane = { source, gain };
      this.mode = "file";
    });
  }
  private fadeLane(seconds: number) {
    const lane = this.lane;
    const ctx = this.synth.ctx;
    if (!lane) return;
    this.lane = null;
    if (!ctx) {
      try {
        lane.source.stop();
      } catch {}
      return;
    }
    lane.gain.gain.setTargetAtTime(0, ctx.currentTime, seconds / 3);
    const src = lane.source;
    setTimeout(() => {
      try {
        src.stop();
        src.disconnect();
        lane.gain.disconnect();
      } catch {}
    }, seconds * 1000 + 50);
  }
  stop() {
    this.generation++;
    this.fallback.stop();
    this.fadeLane(0.25);
    this.mode = "off";
  }
}
