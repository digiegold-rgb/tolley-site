/**
 * Sound for Blocky Worlds. Effects come from the original Synth; music goes through MusicPlayer
 * (real looped tracks from public/game/music when present, the original Sequencer patterns as the fallback).
 */
import { Synth, Sequencer } from "../audio/synth";
import type { MusicId, SfxName } from "../engine/types";
import { MusicPlayer } from "./music";
import type { Settings } from "./save";

export class VoxelAudio {
  synth = new Synth();
  music = new MusicPlayer(this.synth, new Sequencer(this.synth));
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
  /** Start fetching a track before it is needed (the next world, the boss theme). */
  preload(track: string) {
    if (KNOWN.has(track)) this.music.preload(track);
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
const KNOWN = new Set(["title", "factory", "star", "falling", "water", "pipes", "bouncy", "danger", "candy", "dark", "between", "boss", "finale"]);
