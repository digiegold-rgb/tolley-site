/** Use Portal Hoppers' actual original compositions and effects, not a replacement sound pack. */
import { Synth, Sequencer } from "../audio/synth";
import type { MusicId, SfxName } from "../engine/types";
import type { Save } from "./model";
export class PortalAudio {
  synth = new Synth();
  music = new Sequencer(this.synth);
  track: MusicId = "none";
  events = 0;
  notes = 0;
  constructor() {
    const note = this.synth.playNote.bind(this.synth);
    this.synth.playNote = (...args: Parameters<Synth["playNote"]>) => {
      if (this.synth.state() === "running") this.notes++;
      note(...args);
    };
  }
  unlock() {
    this.synth.unlock();
    this.synth.resume();
  }
  configure(settings: Save["settings"]) {
    this.synth.setMuted(settings.muted);
    this.synth.setVolumes(settings.music, settings.effects);
  }
  play(track: MusicId) {
    this.track = track;
    this.music.play(track);
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
