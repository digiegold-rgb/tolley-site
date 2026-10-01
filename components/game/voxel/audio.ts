/**
 * Sound for Blocky Worlds. Effects come from the original Synth; music goes through MusicPlayer
 * (real looped tracks when present, the original Sequencer patterns as the fallback).
 */
import { Synth, Sequencer } from "../audio/synth";
import type { MusicId, SfxName } from "../engine/types";
import type { Settings } from "./save";

export class VoxelAudio {
  synth = new Synth();
  music = new Sequencer(this.synth);
  track: MusicId = "none";
  events = 0;
  unlock() {
    this.synth.unlock();
    this.synth.resume();
  }
  configure(settings: Settings) {
    this.synth.setMuted(settings.muted);
    this.synth.setVolumes(settings.music, settings.effects);
  }
  play(track: string) {
    const id = (KNOWN.has(track) ? track : "title") as MusicId;
    this.track = id;
    this.music.play(id);
  }
  effect = (s: SfxName) => {
    this.events++;
    this.synth.play(s);
  };
  pause() {
    this.music.stop();
  }
  dispose() {
    this.music.stop();
    void this.synth.ctx?.close().catch(() => {});
  }
}
const KNOWN = new Set(["title", "factory", "star", "falling", "water", "pipes", "bouncy", "danger", "candy", "dark", "boss", "finale"]);
