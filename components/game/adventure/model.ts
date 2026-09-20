/** Pure adventure rules. Rendering and physics live in Scene; saves never contain transient combat state. */
export type Hero = 'frog' | 'fox' | 'cat';
export type Difficulty = 'adventure' | 'challenge';
export type Point = { x: number; y: number; z: number };
export type Settings = { muted: boolean; reducedMotion: boolean; quality: 'low' | 'high'; sensitivity: number };
export type Progress = { version: 1; hero: Hero; difficulty: Difficulty; checkpoint: number; seals: string[]; secrets: string[]; solved: string[]; boomerang: boolean; finished: boolean; settings: Settings };
export const SAVE_KEY = 'tolley-portal-adventure-v1';
export const CHECKPOINTS: Point[] = [
  { x: 0, y: 1.3, z: 9 }, { x: 0, y: 1.3, z: -48 }, { x: 0, y: 1.3, z: -63 },
  { x: 0, y: 1.3, z: -79 }, { x: 0, y: 1.3, z: -95 }, { x: 0, y: 1.3, z: -111 },
];
export const SEALS = [{ id: 'brook', x: -19, y: 0, z: -9 }, { id: 'grove', x: 18, y: 0, z: -20 }, { id: 'ruins', x: -16, y: 0, z: -35 }];
export const SECRETS = [{ id: 'camp', x: -20, y: 0.5, z: 12 }, { id: 'canopy', x: 21, y: 2.7, z: -32 }, { id: 'waterfall', x: -25, y: 0.5, z: -24 }, { id: 'temple', x: 8, y: 0.5, z: -84 }, { id: 'guardian', x: -8, y: 0.5, z: -120 }];
export const SWITCHES = [{ id: 'west', x: -7, y: 0, z: -67 }, { id: 'east', x: 7, y: 0, z: -70 }, { id: 'north', x: 0, y: 0, z: -75 }];
export const TARGETS = [{ id: 'sun', x: -8, y: 2, z: -86 }, { id: 'leaf', x: 0, y: 2, z: -90 }, { id: 'moon', x: 8, y: 2, z: -86 }];
export const GATES = [{ id: 'forest', z: -44 }, { id: 'roots', z: -60 }, { id: 'wind', z: -76 }, { id: 'light', z: -92 }, { id: 'echo', z: -108 }];
export const BLOCKS = [{ id: 'roots', x: -5, z: -53, plateX: 4, plateZ: -55 }, { id: 'echo', x: -5, z: -100, plateX: 4, plateZ: -101 }];
export const AREAS = ['Whisperwood', '01 · Hall of Roots', '02 · Wind Gallery', '03 · Chamber of Light', '04 · Echo Court', '05 · The Heartwood Guardian'];
export const dist = (a: Pick<Point, 'x' | 'z'>, b: Pick<Point, 'x' | 'z'>) => Math.hypot(a.x - b.x, a.z - b.z);
export function freshProgress(hero: Hero = 'fox', difficulty: Difficulty = 'adventure'): Progress {
  return { version: 1, hero, difficulty, checkpoint: 0, seals: [], secrets: [], solved: [], boomerang: false, finished: false, settings: { muted: false, reducedMotion: false, quality: 'high', sensitivity: 1 } };
}
export function parseSave(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || o.version !== 1 || !['frog', 'fox', 'cat'].includes(o.hero) || !['adventure', 'challenge'].includes(o.difficulty)) return null;
    const p = freshProgress(o.hero, o.difficulty);
    const list = (v: unknown, allowed: string[]) => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && allowed.includes(s)))] : [];
    p.seals = list(o.seals, SEALS.map(s => s.id));
    p.secrets = list(o.secrets, SECRETS.map(s => s.id));
    const solved = list(o.solved, GATES.map(g => g.id));
    // Only retain a contiguous chain; a damaged save must not spawn behind locked doors.
    for (const gate of GATES) {
      if (!solved.includes(gate.id) || (gate.id === 'forest' && p.seals.length !== 3)) break;
      p.solved.push(gate.id);
    }
    p.boomerang = p.solved.includes('roots');
    p.checkpoint = Number.isInteger(o.checkpoint) ? Math.max(0, Math.min(o.checkpoint, p.solved.length)) : 0;
    p.finished = o.finished === true && p.solved.includes('echo');
    if (o.settings && typeof o.settings === 'object') {
      p.settings.muted = o.settings.muted === true;
      p.settings.reducedMotion = o.settings.reducedMotion === true;
      p.settings.quality = o.settings.quality === 'low' ? 'low' : 'high';
      p.settings.sensitivity = typeof o.settings.sensitivity === 'number' && Number.isFinite(o.settings.sensitivity) ? Math.max(.3, Math.min(2, o.settings.sensitivity)) : 1;
    }
    return p;
  } catch { return null; }
}
export function readSave(): Progress | null { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
export function writeSave(p: Progress): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); return true; } catch { return false; } }

export type Enemy = { id: string; kind: 'charger' | 'spitter' | 'shield' | 'boss'; x: number; z: number; homeX: number; homeZ: number; hp: number; maxHp: number; phase: 'idle' | 'warn' | 'attack' | 'recover'; timer: number; aimX: number; aimZ: number; flash: number; stun: number };
export type Shot = { x: number; z: number; vx: number; vz: number; life: number };
const ENEMIES: [string, Enemy['kind'], number, number][] = [
  ['moss', 'charger', -13, -9], ['fern', 'spitter', 15, -15], ['stone', 'shield', -12, -32],
  ['watcher', 'charger', 6, -33], ['echo-guard', 'shield', 0, -102], ['guardian', 'boss', 0, -119],
];
export type Snapshot = { health: number; stamina: number; area: string; objective: string; prompt: string; message: string; boss: number | null; bossPhase: number; seals: number; secrets: number; boomerang: boolean; timer: number; targets: number; finished: boolean; storageOk: boolean; locked: string | null };
export class AdventureGame {
  progress: Progress;
  position: Point;
  yaw = Math.PI;
  health = 6;
  stamina = 100;
  invulnerable = 0;
  attackTime = 0;
  dodgeTime = 0;
  shield = false;
  paused = true;
  time = 0;
  message = 'Cubo: Three forest beacons will reveal the temple. Follow the golden lights.';
  messageTime = 8;
  storageOk = true;
  respawn = 0;
  blockReset = 0;
  locked: string | null = null;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  switches: string[] = [];
  switchTime = 0;
  targets: string[] = [];
  blocks: Record<string, { x: number; z: number }> = {};
  plateHold = 0;
  throwTime = 0;
  throwTarget: { id: string; x: number; z: number } | null = null;
  throwHit = false;
  sound: ((kind: 'hit' | 'reward' | 'hurt' | 'throw') => void) | null = null;
  constructor(p: Progress) {
    this.progress = p;
    this.position = { ...CHECKPOINTS[p.checkpoint] };
    this.resetEnemies();
    this.resetBlocks();
  }
  resetEnemies() {
    this.enemies = ENEMIES.map(([id, kind, x, z]) => ({ id, kind, x, z, homeX: x, homeZ: z, hp: kind === 'boss' ? (this.progress.finished ? 0 : 18) : kind === 'shield' ? 4 : 3, maxHp: kind === 'boss' ? 18 : kind === 'shield' ? 4 : 3, phase: 'idle', timer: .5, aimX: 0, aimZ: 0, flash: 0, stun: 0 }));
  }
  save() { this.storageOk = writeSave(this.progress); }
  setSound(sound: AdventureGame['sound']) { this.sound = sound; }
  setPaused(paused: boolean) { this.paused = paused; }
  say(message: string) { this.message = message; this.messageTime = 6; }
  areaIndex() { return Math.max(0, Math.min(5, Math.floor((-this.position.z - 44) / 16) + 1)); }
  objective() {
    if (this.progress.finished) return 'The forest is awake. Explore for the remaining star seeds!';
    if (!this.progress.solved.includes('forest')) return `Awaken the forest beacons · ${this.progress.seals.length}/3`;
    if (!this.progress.solved.includes('roots')) return 'Hall of Roots · Push the stone onto the gold plate';
    if (!this.progress.solved.includes('wind')) return 'Wind Gallery · Activate all three switches before time runs out';
    if (!this.progress.solved.includes('light')) return 'Chamber of Light · Send the boomerang: sun → leaf → moon';
    if (!this.progress.solved.includes('echo')) return 'Echo Court · Hold the plate, stun the guardian, ring the bell';
    return 'Heartwood Guardian · Dodge, reflect, then break its shield';
  }
  solve(id: string, message: string) {
    if (this.progress.solved.includes(id)) return;
    this.progress.solved.push(id);
    if (id === 'roots') this.progress.boomerang = true;
    this.say(message); this.sound?.('reward'); this.save();
  }
  resetBlocks() { for (const b of BLOCKS) this.blocks[b.id] = { x: b.x, z: b.z }; this.plateHold = 0; this.blockReset++; }
  restartCheckpoint() {
    this.position = { ...CHECKPOINTS[this.progress.checkpoint] };
    this.health = 6; this.stamina = 100; this.invulnerable = 2;
    this.shots = []; this.switches = []; this.switchTime = 0; this.targets = []; this.locked = null;
    this.throwTime = 0; this.throwTarget = null; this.attackTime = 0; this.dodgeTime = 0;
    this.resetEnemies(); this.resetBlocks(); this.respawn++;
    this.say('Back at your campfire. Your discoveries and completed puzzles are safe.');
  }
  hint() {
    const hints = [
      'Cubo: Explore west by the brook, east in the grove, and northwest at the broken pillars. E awakens a beacon.',
      'Cubo: Walk into the square stone to push it. Line it up with the gold floor plate. R resets loose stones.',
      'Cubo: Plan your route first. Start west, cross east, then head north. Dodge helps! E activates each switch.',
      'Cubo: The wall says sun, leaf, moon. Face a symbol, use Tab to lock on, then Q. A wrong symbol resets the sequence.',
      'Cubo: Push the stone onto the plate. Q stuns the shield guardian. While it is stunned—or defeated—ring the north bell with E.',
      'Cubo: First dodge its charge and strike while it rests. Next face its glowing seeds with your shield. Finally use your boomerang, then your sword.',
    ];
    this.say(hints[this.areaIndex()]);
  }
  nearbyInteraction(): { text: string; id: string } | null {
    for (const s of SEALS) if (!this.progress.seals.includes(s.id) && dist(this.position, s) < 2.6) return { text: 'E · Awaken beacon', id: s.id };
    if (this.areaIndex() === 2 && !this.progress.solved.includes('wind')) for (const s of SWITCHES) if (dist(this.position, s) < 2.5) return { text: 'E · Ring wind chime', id: s.id };
    if (dist(this.position, { x: 0, z: -105 }) < 2.8 && !this.progress.solved.includes('echo')) return { text: 'E · Ring the echo bell', id: 'bell' };
    return null;
  }
  interact() {
    const item = this.nearbyInteraction(); if (!item) return;
    if (SEALS.some(s => s.id === item.id)) {
      this.progress.seals.push(item.id); this.health = 6;
      this.say('A forest beacon awakens. Its light points toward the temple.'); this.sound?.('reward');
      if (this.progress.seals.length === 3) this.solve('forest', 'The temple opens! Follow the path north beneath the stone arch.');
      this.save();
    } else if (SWITCHES.some(s => s.id === item.id)) {
      if (!this.switches.length) this.switchTime = this.progress.difficulty === 'challenge' ? 10 : 15;
      if (!this.switches.includes(item.id)) { this.switches.push(item.id); this.sound?.('reward'); }
      if (this.switches.length === 3) { this.solve('wind', 'The wind sings in harmony. The Chamber of Light is open.'); this.switchTime = 0; }
    } else if (item.id === 'bell') {
      const guard = this.enemies.find(e => e.id === 'echo-guard')!;
      if (this.plateActive('echo') && (guard.stun > 0 || guard.hp <= 0)) this.solve('echo', 'The final door opens. A campfire waits before the Heartwood Guardian.');
      else this.say('The bell needs a weighted plate and a quiet guardian. Ask Cubo with H.');
    }
  }
  plateActive(id: string) { const b = BLOCKS.find(b => b.id === id)!; return dist(this.blocks[id], { x: b.plateX, z: b.plateZ }) < 1.25; }
  lock() {
    const candidates = this.aimCandidates();
    const index = candidates.findIndex(c => c.id === this.locked);
    this.locked = candidates.length ? candidates[(index + 1) % candidates.length].id : null;
  }
  aimCandidates() {
    const targets = this.areaIndex() === 3 && !this.progress.solved.includes('light') ? TARGETS : [];
    return [...this.enemies.filter(e => e.hp > 0 && Math.abs(e.z - this.position.z) < 13), ...targets].filter(e => dist(this.position, e) < 17).sort((a, b) => dist(this.position, a) - dist(this.position, b));
  }
  facing(p: { x: number; z: number }, threshold = .2) {
    const d = dist(this.position, p); return d < .1 || ((p.x - this.position.x) * Math.sin(this.yaw) + (p.z - this.position.z) * Math.cos(this.yaw)) / d > threshold;
  }
  attack() {
    if (this.attackTime > 0 || this.dodgeTime > 0 || this.stamina < 12) return;
    this.attackTime = .42; this.stamina -= 12; this.sound?.('hit');
    for (const e of this.enemies) if (e.hp > 0 && dist(this.position, e) < (e.kind === 'boss' ? 3.7 : 2.6) && this.facing(e)) {
      const phase = this.bossPhase(e);
      if ((e.kind === 'shield' && e.stun <= 0 && e.phase !== 'recover') || (e.kind === 'boss' && (phase === 2 || (phase === 3 && e.stun <= 0) || (phase === 1 && e.phase !== 'recover')))) { this.say('A shielded foe! Wait for an opening, or stun it with your boomerang.'); continue; }
      this.hitEnemy(e, 1);
    }
  }
  dodge() { if (this.stamina >= 25 && this.dodgeTime <= 0) { this.stamina -= 25; this.dodgeTime = .3; this.invulnerable = .4; } }
  throwBoomerang() {
    if (!this.progress.boomerang || this.throwTime > 0) return;
    const candidates = this.aimCandidates();
    const target = candidates.find(e => e.id === this.locked) ?? candidates.find(e => this.facing(e, .82));
    this.throwTarget = target ? { id: target.id, x: target.x, z: target.z } : { id: '', x: this.position.x + Math.sin(this.yaw) * 11, z: this.position.z + Math.cos(this.yaw) * 11 };
    this.throwTime = .9; this.throwHit = false; this.sound?.('throw');
  }
  hitEnemy(e: Enemy, damage: number) {
    e.hp = Math.max(0, e.hp - damage); e.flash = .2;
    if (e.hp === 0) {
      this.health = Math.min(6, this.health + 1); this.sound?.('reward');
      if (e.kind === 'boss') { this.progress.finished = true; this.say('You did it! The Heartwood Guardian is free, and the forest portal shines again.'); this.save(); }
    }
  }
  hurt(source: { x: number; z: number }, amount = 1) {
    if (this.invulnerable > 0 || this.progress.finished) return;
    if (this.shield && this.stamina >= 15 && this.facing(source, .25)) { this.stamina -= 15; this.invulnerable = .25; this.sound?.('hit'); return; }
    this.health -= amount; this.invulnerable = 1; this.sound?.('hurt');
    if (this.health <= 0) this.restartCheckpoint();
  }
  bossPhase(e: Enemy) { return e.hp > 12 ? 1 : e.hp > 6 ? 2 : 3; }
  tick(dt: number) {
    if (this.paused) return;
    this.time += dt; this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.attackTime = Math.max(0, this.attackTime - dt); this.dodgeTime = Math.max(0, this.dodgeTime - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.stamina = Math.min(100, this.stamina + dt * (this.shield ? 3 : 22));
    if (this.position.y < -5) this.restartCheckpoint();
    const area = this.areaIndex();
    if (area > this.progress.checkpoint && this.progress.solved.length >= area) { this.progress.checkpoint = area; this.health = 6; this.save(); this.say('Campfire lit · Progress saved. H asks Cubo for a hint.'); }
    for (const s of SECRETS) if (!this.progress.secrets.includes(s.id) && dist(this.position, s) < 1.5 && Math.abs(this.position.y - s.y) < 2) { this.progress.secrets.push(s.id); this.health = 6; this.say(`Star seed found · ${this.progress.secrets.length}/${SECRETS.length}. Hearts restored!`); this.sound?.('reward'); this.save(); }
    if (this.plateActive('roots') && !this.progress.solved.includes('roots')) { this.plateHold += dt; if (this.plateHold > .8) this.solve('roots', 'The Gale Boomerang is yours! Q throws it; Tab locks onto a foe or symbol.'); } else this.plateHold = 0;
    if (this.switchTime > 0) { this.switchTime -= dt; if (this.switchTime <= 0) { this.switches = []; this.say('The wind chimes fell quiet. Try a shorter route.'); } }
    if (this.throwTime > 0) {
      this.throwTime = Math.max(0, this.throwTime - dt);
      if (this.throwTime <= .45 && !this.throwHit && this.throwTarget) {
        this.throwHit = true;
        const t = this.throwTarget;
        if (TARGETS.some(s => s.id === t.id) && area === 3 && !this.progress.solved.includes('light')) {
          if (TARGETS[this.targets.length]?.id === t.id) { this.targets.push(t.id); this.sound?.('reward'); if (this.targets.length === 3) this.solve('light', 'Sun, leaf, moon. The ancient door opens into Echo Court.'); }
          else { this.targets = []; this.say('The symbols dim. Read the order: sun → leaf → moon.'); }
        }
        const e = this.enemies.find(e => e.id === t.id && e.hp > 0);
        if (e && dist(e, t) < 3) { e.stun = 3; e.flash = .2; if (e.kind !== 'boss' && e.kind !== 'shield') this.hitEnemy(e, 1); }
      }
    }
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt);
      if (e.hp <= 0 || e.stun > 0) continue;
      const d = dist(this.position, e);
      const sameRoom = e.kind === 'boss' ? area === 5 : e.id === 'echo-guard' ? area === 4 : area === 0;
      if (!sameRoom || d > 18) { e.phase = 'idle'; e.timer = .7; continue; }
      const phase = this.bossPhase(e);
      e.timer -= dt;
      if (e.phase === 'idle') {
        if (d > (e.kind === 'spitter' || (e.kind === 'boss' && phase === 2) ? 8 : 4)) {
          const speed = e.kind === 'boss' ? 2.3 : 1.9;
          e.x += (this.position.x - e.x) / d * dt * speed; e.z += (this.position.z - e.z) / d * dt * speed;
        } else if (e.timer <= 0) { e.phase = 'warn'; e.timer = this.progress.difficulty === 'challenge' ? .55 : .95; e.aimX = (this.position.x - e.x) / Math.max(d, .01); e.aimZ = (this.position.z - e.z) / Math.max(d, .01); }
      } else if (e.phase === 'warn' && e.timer <= 0) {
        if (e.kind === 'spitter' || (e.kind === 'boss' && phase === 2)) {
          this.shots.push({ x: e.x, z: e.z, vx: e.aimX * 9, vz: e.aimZ * 9, life: 3 }); e.phase = 'recover'; e.timer = 1.6;
        } else { e.phase = 'attack'; e.timer = .65; }
      } else if (e.phase === 'attack') {
        e.x += e.aimX * dt * 12; e.z += e.aimZ * dt * 12;
        if (dist(this.position, e) < (e.kind === 'boss' ? 2.5 : 1.4)) this.hurt(e);
        if (e.timer <= 0) { e.phase = 'recover'; e.timer = this.progress.difficulty === 'challenge' ? 1.2 : 2.2; }
      } else if (e.phase === 'recover' && e.timer <= 0) { e.phase = 'idle'; e.timer = .6; }
      e.x = Math.max(e.homeX - 9, Math.min(e.homeX + 9, e.x));
      e.z = Math.max(e.homeZ - (e.kind === 'boss' ? 5 : 6), Math.min(e.homeZ + (e.kind === 'boss' ? 7 : 6), e.z));
    }
    for (const s of this.shots) {
      s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt;
      if (dist(this.position, s) < 1 && this.position.y < 2.4) {
        if (this.shield && this.stamina >= 15 && this.facing({ x: s.x - s.vx, z: s.z - s.vz }, .25)) {
          this.stamina -= 15;
          const boss = this.enemies.find(e => e.kind === 'boss')!;
          if (area === 5 && this.bossPhase(boss) === 2) { this.hitEnemy(boss, 2); this.say('Perfect reflection! Its seed breaks the magic shield.'); }
        } else this.hurt({ x: s.x - s.vx, z: s.z - s.vz });
        s.life = 0;
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
    if (this.locked && !this.aimCandidates().some(e => e.id === this.locked)) this.locked = null;
  }
  snapshot(): Snapshot {
    const boss = this.enemies.find(e => e.kind === 'boss')!;
    return { health: this.health, stamina: this.stamina, area: AREAS[this.areaIndex()], objective: this.objective(), prompt: this.nearbyInteraction()?.text ?? '', message: this.messageTime > 0 ? this.message : '', boss: this.areaIndex() === 5 && boss.hp > 0 ? boss.hp / boss.maxHp : null, bossPhase: this.bossPhase(boss), seals: this.progress.seals.length, secrets: this.progress.secrets.length, boomerang: this.progress.boomerang, timer: this.switchTime, targets: this.targets.length, finished: this.progress.finished, storageOk: this.storageOk, locked: this.locked };
  }
}
