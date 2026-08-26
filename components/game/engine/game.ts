/**
 * Game — screen state machine, level loading, the GameCtx entities see,
 * cutscenes, save, debug hooks. Created inside a useEffect by GameShell.
 */
import {
  TILE,
  VH,
  VW,
  overlaps,
  Rng,
  type Bubble,
  type EntityLike,
  type FriendId,
  type GameCtx,
  type HeroKind,
  type LevelDef,
  type LevelEntity,
  type Light,
  type Platform,
  type PowerId,
  type Screen,
  type SfxName,
  type UiCard,
  type UiSnapshot,
} from "./types";
import { Tilemap } from "./tilemap";
import { Camera } from "./camera";
import { Particles } from "./particles";
import { Input, type Action } from "./input";
import { startLoop } from "./loop";
import { Renderer, type HudState } from "./render";
import { loadSave, writeSave, hasSave, type SaveData } from "./save";
import { Synth, Sequencer } from "../audio/synth";
import { CuboBrain } from "../ai/companion";
import { getLevel, LEVELS } from "../worlds/levels";
import { CUBO_LINES, FRIEND_BY_ID, WORLD_START_LINES, heroName } from "../worlds/friends";
import { SugarSultan, Whistler, CaptainClank } from "../worlds/bosses";
import {
  BlockPickup,
  BounceBlob,
  Cage,
  Checkpoint,
  Coin,
  Cubo,
  Enemy,
  GlassCage,
  Hero,
  HeroCage,
  Mover,
  Npc,
  Orb,
  Portal,
  Projectile,
  Shell,
  Sign,
  Spawner,
  Trigger,
  Warp,
  emptyCuboControls,
  emptyHeroControls,
  type Actor,
} from "./entities";

export interface GameOptions {
  level?: number;
  hero?: HeroKind;
  god?: boolean;
  mute?: boolean;
  seed?: number;
  touch?: boolean;
}

interface CutsceneStep {
  t: number;
  fn: () => void;
}
interface Cutscene {
  steps: CutsceneStep[];
  t: number;
  i: number;
  end: number;
  each?: (dt: number) => void;
}

const PASSIVES: PowerId[] = ["doubleJump", "glide", "magnet", "shield", "wallCling", "glow"];

export class Game implements GameCtx {
  /* ── GameCtx ── */
  map!: Tilemap;
  level!: LevelDef;
  hero!: Hero;
  cubo!: Cubo;
  camera = new Camera();
  particles: Particles;
  rng: Rng;
  platforms: Platform[] = [];
  lights: Light[] = [];
  bubbles: Bubble[] = [];
  time = 0;
  timeScale = 1;
  twoPlayer = false;
  god: boolean;

  /* ── systems ── */
  input = new Input();
  synth = new Synth();
  seq: Sequencer;
  renderer: Renderer;
  brain = new CuboBrain();
  private ents: EntityLike[] = [];
  private stopLoop: (() => void) | null = null;
  private listeners = new Set<(s: UiSnapshot) => void>();

  /* ── state ── */
  screen: Screen = "title";
  levelNo = 1;
  save: SaveData;
  activeCard: UiCard | null = null;
  private cardT = 0;
  private cardHold = false;
  private checkpoint = { x: 0, y: 0 };
  private cutscene: Cutscene | null = null;
  private clearT = 0;
  private flash = 0;
  private letterbox = 0;
  private letterboxTarget = 0;
  private prompt: string | null = null;
  private heroCagedFlag = false;
  private cuboPresent = true;
  private introSaid = false;
  private levelTime = 0;
  private selectIndex = 0;
  private selectWorld = 1;
  private shellsCracked = 0;
  private finaleStage = 0;
  private endingT = 0;
  private touch: boolean;
  private lastSnapshot = "";
  private levelCoins = 0;
  private opts: GameOptions;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions = {}) {
    this.opts = opts;
    this.god = !!opts.god;
    this.touch = !!opts.touch;
    this.rng = new Rng(opts.seed ?? (Date.now() & 0xffffffff));
    this.particles = new Particles(this.rng);
    this.renderer = new Renderer(canvas);
    this.seq = new Sequencer(this.synth);
    this.save = loadSave();
    if (opts.hero) this.save.hero = opts.hero;
    if (opts.mute) this.save.muted = true;
    this.synth.setMuted(this.save.muted);
    this.selectIndex = ["frog", "fox", "cat"].indexOf(this.save.hero);
    this.selectWorld = Math.min(this.save.unlocked, 10);
    this.input.onAny = () => {
      if (!this.synth.unlocked) this.synth.unlock();
    };
    // A dummy level so render never sees undefined before start().
    this.loadLevel(1, true);
    this.screen = "title";
  }

  /* ═══════════ lifecycle ═══════════ */
  start(): void {
    this.input.attach();
    this.stopLoop = startLoop(
      (dt) => this.step(dt),
      () => this.render(),
    );
    if (this.opts.level) {
      this.levelNo = Math.min(10, Math.max(1, this.opts.level));
      this.loadLevel(this.levelNo);
      this.screen = "play";
      this.introSaid = false;
    }
    this.seq.play("title");
    this.emit(true);
  }

  dispose(): void {
    this.stopLoop?.();
    this.stopLoop = null;
    this.input.dispose();
    this.seq.stop();
    try {
      void this.synth.ctx?.close();
    } catch {
      /* ignore */
    }
  }

  resize(w: number, h: number): void {
    this.renderer.resize(w, h);
  }
  setFont(f: string): void {
    this.renderer.font = f;
  }
  subscribe(cb: (s: UiSnapshot) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  /** Any user gesture (pointer/touch) from the shell — unlocks audio. */
  gesture(): void {
    this.synth.unlock();
    this.synth.resume();
  }

  toggleMute(): void {
    this.save.muted = !this.save.muted;
    this.synth.setMuted(this.save.muted);
    writeSave(this.save);
    this.emit(true);
  }
  toggleTwoPlayer(): void {
    this.twoPlayer = !this.twoPlayer;
    if (!this.twoPlayer) this.cubo.ctl = emptyCuboControls();
    this.emit(true);
  }

  /** DOM overlay buttons. */
  ui(action: "start" | "continue" | "select-left" | "select-right" | "world-left" | "world-right" | "confirm" | "pause" | "resume" | "quit" | "next" | "dismiss" | "restart"): void {
    this.gesture();
    switch (action) {
      case "start":
        if (this.screen === "title") this.toSelect();
        break;
      case "continue":
        if (this.screen === "title") {
          this.selectWorld = Math.min(this.save.unlocked, 10);
          this.toSelect();
        }
        break;
      case "select-left":
        this.selectIndex = (this.selectIndex + 2) % 3;
        this.sfx("select");
        break;
      case "select-right":
        this.selectIndex = (this.selectIndex + 1) % 3;
        this.sfx("select");
        break;
      case "world-left":
        this.selectWorld = Math.max(1, this.selectWorld - 1);
        this.sfx("select");
        break;
      case "world-right":
        this.selectWorld = Math.min(this.save.unlocked, this.selectWorld + 1);
        this.sfx("select");
        break;
      case "confirm":
        this.confirm();
        break;
      case "pause":
        if (this.screen === "play") this.setScreen("pause");
        break;
      case "resume":
        if (this.screen === "pause") this.setScreen("play");
        break;
      case "quit":
        this.seq.play("title");
        this.setScreen("title");
        break;
      case "next":
        if (this.screen === "clear") this.nextLevel();
        break;
      case "dismiss":
        this.dismissCard();
        break;
      case "restart":
        this.save = { ...this.save, unlocked: 1, rescued: [], coins: 0, finished: false };
        writeSave(this.save);
        this.selectWorld = 1;
        this.seq.play("title");
        this.setScreen("title");
        break;
    }
    this.emit(true);
  }

  /* ═══════════ screens ═══════════ */
  private setScreen(s: Screen): void {
    this.screen = s;
    this.input.clearAll();
    this.emit(true);
  }

  private toSelect(): void {
    this.sfx("select");
    this.setScreen("select");
  }

  private confirm(): void {
    if (this.screen === "title") this.toSelect();
    else if (this.screen === "select") {
      const kinds: HeroKind[] = ["frog", "fox", "cat"];
      this.save.hero = kinds[this.selectIndex];
      writeSave(this.save);
      this.levelNo = this.selectWorld;
      this.loadLevel(this.levelNo);
      this.sfx("portal");
      this.setScreen("intro");
    } else if (this.screen === "intro") {
      this.setScreen("play");
      this.levelTime = 0;
    } else if (this.screen === "clear") this.nextLevel();
    else if (this.screen === "pause") this.setScreen("play");
    else if (this.screen === "ending") {
      this.seq.play("title");
      this.setScreen("title");
    }
  }

  private nextLevel(): void {
    if (this.levelNo >= LEVELS.length) {
      this.beginEnding();
      return;
    }
    this.levelNo++;
    this.loadLevel(this.levelNo);
    this.setScreen("intro");
  }

  private beginEnding(): void {
    this.save.finished = true;
    this.save.unlocked = 10;
    this.cutscene = null;
    this.letterbox = 0;
    this.letterboxTarget = 0;
    this.prompt = null;
    writeSave(this.save);
    this.seq.play("finale");
    this.endingT = 0;
    this.setScreen("ending");
  }

  /* ═══════════ level loading ═══════════ */
  private loadLevel(n: number, silent = false): void {
    const level = getLevel(n);
    this.level = level;
    this.map = new Tilemap(level.rows);
    this.ents = [];
    this.bubbles = [];
    this.lights = [];
    this.particles.clear();
    this.cutscene = null;
    this.prompt = null;
    this.heroCagedFlag = false;
    this.shellsCracked = 0;
    this.finaleStage = 0;
    this.introSaid = false;
    this.levelTime = 0;
    this.levelCoins = 0;
    this.timeScale = 1;
    this.letterbox = 0;
    this.letterboxTarget = 0;
    this.clearT = 0;
    const m = this.map.markers;
    const hx = m.hero?.x ?? TILE * 2;
    const hy = m.hero?.y ?? TILE * 2;
    const kind = this.save.hero;
    this.hero = new Hero(hx + 5, hy + TILE - 34, kind);
    for (const f of this.save.rescued) this.hero.grantPower(FRIEND_BY_ID[f].power);
    if (this.god) for (const f of Object.keys(FRIEND_BY_ID) as FriendId[]) this.hero.grantPower(FRIEND_BY_ID[f].power);
    this.checkpoint = { x: this.hero.body.x, y: this.hero.body.y };
    const kx = m.cubo?.x ?? hx - TILE;
    const ky = m.cubo?.y ?? hy;
    this.cubo = new Cubo(kx + 4, ky + TILE - 24);
    this.cuboPresent = !level.flags.home;
    this.brain = new CuboBrain();
    this.ents.push(this.cubo, this.hero);
    for (const c of m.coins) this.ents.push(new Coin(c.x, c.y));
    for (const c of m.checkpoints) this.ents.push(new Checkpoint(c.x, c.y));
    if (m.orb) this.ents.push(new Orb(m.orb.x - 2, m.orb.y - 2, !!level.flags.endlessFall));
    for (const e of level.entities) this.spawn(e);
    this.camera.setWorld(this.map.pixelW, this.map.pixelH, level.cameraMode);
    this.camera.snapTo(this.hero.body);
    if (!silent) this.seq.play(level.music);
    this.emit(true);
  }

  private spawn(e: LevelEntity): void {
    const px = e.x * TILE;
    const py = e.y * TILE;
    switch (e.kind) {
      case "cage":
        this.ents.push(new Cage(px - 2, py + TILE - 44, e.friend));
        break;
      case "enemy":
        this.ents.push(new Enemy(px, py, e.type, e.range ?? 4));
        break;
      case "boss":
        this.spawnBoss(e.type, px, py);
        break;
      case "sign":
        this.ents.push(new Sign(px, py, e.text));
        break;
      case "mover":
        this.ents.push(new Mover(px, py, e.w * TILE, e.dx * TILE, e.dy * TILE, e.speed));
        break;
      case "warp":
        this.ents.push(new Warp(px, py, e.tx, e.ty));
        break;
      case "npc":
        this.ents.push(new Npc(px, py, e.who, e.lines, e.friend));
        break;
      case "blob":
        this.ents.push(new BounceBlob(px, py));
        break;
      case "portal": {
        const p = new Portal(px, py, e.id);
        if (e.id === "l1-out") p.active = false;
        this.ents.push(p);
        break;
      }
      case "trigger":
        this.ents.push(new Trigger(px, py, e.w * TILE, e.h * TILE, e.id));
        break;
      case "spawner":
        this.ents.push(new Spawner(px, py, e.w * TILE));
        break;
      case "glassCage":
        this.ents.push(new GlassCage(px, py, e.friend));
        break;
    }
  }

  private spawnBoss(type: "sultan" | "whistler" | "clank", px: number, py: number): void {
    if (type === "sultan") this.ents.push(new SugarSultan(px, py));
    else if (type === "whistler") this.ents.push(new Whistler(px, py));
    else this.ents.push(new CaptainClank(px, py));
    this.seq.play("boss");
    this.sfx("roar");
    this.shake(0.6);
  }

  /* ═══════════ GameCtx impl ═══════════ */
  sfx(name: SfxName): void {
    this.synth.play(name);
  }
  add(e: EntityLike): void {
    this.ents.push(e);
  }
  entities(): EntityLike[] {
    return this.ents;
  }
  say(speaker: Bubble["speaker"], text: string, x: number, y: number, ttl = 2.5): void {
    // one bubble per speaker
    this.bubbles = this.bubbles.filter((b) => b.speaker !== speaker);
    const color = speaker === "cubo" ? "#60a5fa" : speaker === "hero" ? "#4ade80" : speaker === "boss" ? "#f472b6" : "#f59e0b";
    this.bubbles.push({ speaker, text, x, y, ttl, color });
  }
  card(card: UiCard, seconds = 2.5): void {
    this.activeCard = card;
    this.cardT = this.god ? 0.2 : seconds;
    this.cardHold = true;
    this.emit(true);
  }
  shake(a: number): void {
    this.camera.addTrauma(a);
  }
  friendFreed(id: FriendId): void {
    const f = FRIEND_BY_ID[id];
    if (!this.save.rescued.includes(id)) this.save.rescued.push(id);
    writeSave(this.save);
    this.hero.grantPower(f.power);
    this.sfx("powerup");
    this.particles.confetti(this.hero.cx, this.hero.body.y, 40);
    this.card({ title: `${f.name} joins the Power Wheel!`, body: `${f.powerName} — ${f.powerHint}`, color: f.color }, 3);
    if (this.cuboPresent) {
      this.say("cubo", this.rng.pick(CUBO_LINES.friendFreed), this.cubo.cx, this.cubo.body.y, 3);
    }
    window.setTimeout(() => this.say("npc", f.thanks, this.hero.cx, this.hero.body.y - 10, 3), 50);
  }
  orbBroken(x: number, y: number): void {
    this.sfx("portal");
    this.flash = 1;
    this.shake(0.5);
    this.particles.burst(x, y, 60, ["#a5f3fc", "#c084fc", "#fff"], { speed: 420, gravity: 0, ttl: 1.2 });
    this.clearT = 1.3;
    this.prompt = "PORTAL OPEN!";
  }
  coin(): void {
    this.save.coins++;
    this.levelCoins++;
  }
  trigger(id: string): void {
    this.onTrigger(id);
  }
  bossDefeated(type: "sultan" | "whistler" | "clank", x: number, y: number): void {
    this.seq.play(this.level.music);
    this.flash = 0.6;
    if (type === "clank") {
      this.finaleStage = 4;
      const keeper = this.ents.find((e): e is Npc => e instanceof Npc && e.who === "keeper");
      if (keeper) this.say("npc", "Clank is beaten! The way home is open. Go — your friends are waiting.", keeper.cx, keeper.body.y, 4);
      const p = new Portal(x - TILE / 2, TILE * 15, "home");
      this.ents.push(p);
      this.prompt = "Press ↑ in the portal to go HOME!";
      this.say("cubo", "We did it! Together!", this.cubo.cx, this.cubo.body.y, 3);
    } else {
      this.ents.push(new Orb(x - 18, y, false));
      this.say("cubo", "The orb! Bash it and let's get out of here!", this.cubo.cx, this.cubo.body.y, 3);
    }
  }
  cageHero(x: number, y: number): void {
    if (this.heroCagedFlag || this.hero.dead2) return;
    this.heroCagedFlag = true;
    this.hero.caged = true;
    this.hero.vx = 0;
    this.hero.vy = 0;
    this.ents.push(new HeroCage(x - 20, y));
    this.sfx("hit");
    this.shake(0.4);
    this.say("cubo", this.rng.pick(CUBO_LINES.caged), this.cubo.cx, this.cubo.body.y, 2);
    this.prompt = "Caged! Cubo is coming...";
  }
  heroCaged(): boolean {
    return this.heroCagedFlag;
  }
  freeHero(): void {
    this.heroCagedFlag = false;
    this.hero.caged = false;
    this.hero.invuln = 1.2;
    this.prompt = null;
    this.sfx("powerup");
  }
  reachedCheckpoint(x: number, y: number): void {
    this.checkpoint = { x, y };
  }
  heroRespawned(): void {
    this.hero.respawnAt(this.checkpoint.x, this.checkpoint.y);
    this.heroCagedFlag = false;
    this.ents = this.ents.filter((e) => !(e instanceof Projectile) && !(e instanceof HeroCage));
    this.camera.snapTo(this.hero.body);
    this.sfx("respawn");
    this.particles.burst(this.hero.cx, this.hero.cy, 16, ["#fff", "#4ade80"], { speed: 200, gravity: 0 });
    if (this.cuboPresent) {
      this.cubo.teleportToHero(this);
      this.say("cubo", this.rng.pick(CUBO_LINES.heroRespawn), this.cubo.cx, this.cubo.body.y, 2.5);
    }
  }

  /* ═══════════ triggers + cutscenes ═══════════ */
  private onTrigger(id: string): void {
    switch (id) {
      case "orb-seen":
        if (this.cuboPresent) this.say("cubo", this.rng.pick(CUBO_LINES.orbSeen), this.cubo.cx, this.cubo.body.y, 2.5);
        break;
      case "meet-cubo":
        this.runCutscene([
          { t: 0, fn: () => this.say("cubo", "Hi! I'm Cubo. Nobody ever visits Star World. Can I come with you?", this.cubo.cx, this.cubo.body.y, 3) },
          { t: 3.1, fn: () => this.say("hero", `${heroName(this.hero.heroKind)}: I'm trying to get home. Let's go together!`, this.hero.cx, this.hero.body.y, 2.6) },
          { t: 5.8, fn: () => this.say("cubo", "Hold UP next to me and I'll grow into a pillar. Press X near me for a boost!", this.cubo.cx, this.cubo.body.y, 3.5) },
        ]);
        break;
      case "l1-clank":
        this.l1Cutscene();
        break;
      case "boss-sultan":
        this.spawnBoss("sultan", TILE * 108, TILE * 15);
        this.camera.addTrauma(0.6);
        break;
      case "boss-whistler":
        this.spawnBoss("whistler", TILE * 104, TILE * 15);
        break;
      case "meet-keeper":
        this.keeperCutscene();
        break;
      case "shell-cracked":
        this.shellsCracked++;
        if (this.shellsCracked >= 2 && this.finaleStage === 2) this.clankArrives();
        break;
      default:
        if (id.startsWith("portal:")) this.onPortal(id.slice(7));
    }
  }

  private onPortal(pid: string): void {
    if (pid === "home") {
      this.sfx("portal");
      this.flash = 1;
      this.runCutscene([{ t: 0.8, fn: () => this.beginEnding() }]);
      return;
    }
    if (pid.startsWith("loop")) {
      const portal = this.ents.find((e): e is Portal => e instanceof Portal && e.pid === pid);
      const together = portal && overlaps(portal.body, this.cubo.body);
      this.sfx("portal");
      this.flash = 0.8;
      if (together) {
        // both jump in → the in-between space
        this.hero.body.x = TILE * 48;
        this.hero.body.y = TILE * 15 - 34 + TILE;
        this.hero.vx = 0;
        this.hero.vy = 0;
        this.cubo.teleportToHero(this);
        this.camera.snapTo(this.hero.body);
        this.checkpoint = { x: this.hero.body.x, y: this.hero.body.y };
        this.prompt = null;
        this.particles.burst(this.hero.cx, this.hero.cy, 40, ["#c084fc", "#a5f3fc"], { speed: 300, gravity: 0 });
        this.say("cubo", "It worked! We're... between everything.", this.cubo.cx, this.cubo.body.y, 3);
        for (const e of this.ents) if (e instanceof Portal && e.pid.startsWith("loop")) e.active = false;
      } else {
        const m = this.map.markers;
        this.hero.body.x = (m.hero?.x ?? TILE * 2) + 5;
        this.hero.body.y = (m.hero?.y ?? 0) + TILE - 34;
        this.hero.vx = 0;
        this.hero.vy = 0;
        this.camera.snapTo(this.hero.body);
        this.cubo.teleportToHero(this);
        this.say("cubo", "We looped again! Stand in a portal, wait for me, THEN press UP.", this.cubo.cx, this.cubo.body.y, 3.5);
      }
    }
  }

  private runCutscene(steps: CutsceneStep[], each?: (dt: number) => void): void {
    const end = Math.max(...steps.map((s) => s.t)) + 0.3;
    this.cutscene = { steps: steps.slice().sort((a, b) => a.t - b.t), t: 0, i: 0, end, each };
    this.letterboxTarget = 1;
  }

  private l1Cutscene(): void {
    const clank = this.ents.find((e): e is Npc => e instanceof Npc && e.who === "clank");
    const portal = this.ents.find((e): e is Portal => e instanceof Portal && e.pid === "l1-out");
    const cx = clank?.cx ?? this.hero.cx + 200;
    const cy = clank?.body.y ?? this.hero.body.y;
    const hero = this.hero;
    this.runCutscene(
      [
        { t: 0, fn: () => this.say("boss", "Well, well. The little hero who freed my prisoner.", cx, cy, 2.8) },
        { t: 2.9, fn: () => this.say("boss", "Heroes are SO inconvenient. Good thing I built the HERO REMOVER 3000!", cx, cy, 3.2) },
        {
          t: 6.2,
          fn: () => {
            this.sfx("ultraCharge");
            this.flash = 0.7;
            this.shake(0.5);
            hero.noClip = true;
            hero.vx = 0;
            hero.vy = 0;
            if (portal) portal.active = true;
            this.sfx("portal");
          },
        },
        { t: 6.6, fn: () => this.say("hero", `${heroName(hero.heroKind)}: Whoa— hey! I'll be back for everyone, I promise!`, hero.cx, hero.body.y, 2.4) },
        { t: 9.4, fn: () => this.say("boss", "Enjoy the OTHER side of the universe. Mwahaha— *clank*.", cx, cy, 2.2) },
        {
          t: 11.2,
          fn: () => {
            this.sfx("portal");
            this.flash = 1;
            this.clearT = 0.9;
          },
        },
      ],
      (dt) => {
        if (!hero.noClip || !portal) return;
        const tx = portal.cx - hero.body.w / 2;
        const ty = portal.cy - hero.body.h / 2 - 10;
        hero.body.x += (tx - hero.body.x) * Math.min(1, dt * 1.4);
        hero.body.y += (ty - hero.body.y) * Math.min(1, dt * 1.4);
        hero.anim += dt;
        if (this.rng.next() < 0.5) this.particles.trail(hero.cx + this.rng.range(-14, 14), hero.body.y + hero.body.h, "#c084fc");
      },
    );
  }

  private keeperCutscene(): void {
    const keeper = this.ents.find((e): e is Npc => e instanceof Npc && e.who === "keeper");
    if (!keeper || this.finaleStage > 0) return;
    this.finaleStage = 1;
    const kx = keeper.cx;
    const ky = keeper.body.y;
    this.runCutscene([
      { t: 0, fn: () => this.say("npc", "A visitor. Two visitors! Nobody reaches the In-Between alone.", kx, ky, 3) },
      { t: 3.1, fn: () => this.say("npc", "I am the Keeper. I make the portals. I can send you home... if nothing gets in the way.", kx, ky, 3.6) },
      {
        t: 6.9,
        fn: () => {
          this.sfx("roar");
          this.shake(0.8);
          this.flash = 0.8;
          this.say("boss", "SURPRISE, thief! I followed you through the portal!", kx + 120, ky - 40, 2.8);
        },
      },
      {
        t: 9.8,
        fn: () => {
          this.sfx("crack");
          this.shake(0.5);
          keeper.shelled = true;
          this.cubo.shelled = true;
          this.cubo.pillarH = 0;
          this.ents.push(new Shell(keeper), new Shell(this.cubo));
          this.particles.burst(kx, ky, 30, ["#fbcfe8", "#f472b6"], { speed: 300 });
          this.particles.burst(this.cubo.cx, this.cubo.cy, 30, ["#fbcfe8", "#f472b6"], { speed: 300 });
          this.say("boss", "Candy shells for everyone! Now the portals are MINE. Ta-ta!", kx + 120, ky - 40, 3);
        },
      },
      {
        t: 13,
        fn: () => {
          this.finaleStage = 2;
          this.prompt = "Crack the candy shells! Bash each one 3 times (X).";
          this.say("hero", `${heroName(this.hero.heroKind)}: Nobody shells my friends. Hang on, Cubo!`, this.hero.cx, this.hero.body.y, 3);
        },
      },
    ]);
  }

  private clankArrives(): void {
    this.finaleStage = 3;
    this.prompt = null;
    const keeper = this.ents.find((e): e is Npc => e instanceof Npc && e.who === "keeper");
    const kx = keeper?.cx ?? this.hero.cx;
    const ky = keeper?.body.y ?? this.hero.body.y;
    this.runCutscene([
      { t: 0, fn: () => this.say("cubo", "Free! Thanks, partner. Now let's go ho—", this.cubo.cx, this.cubo.body.y, 2.2) },
      {
        t: 2.3,
        fn: () => {
          this.sfx("roar");
          this.shake(0.9);
          this.spawnBoss("clank", TILE * 76, TILE * 16);
          this.say("boss", "CLANK! Did you think a portal could stop ME? I brought the big machine.", TILE * 76, TILE * 10, 3.2);
        },
      },
      { t: 5.6, fn: () => this.say("npc", "His machine floats too high for you! Cubo — those blocks. You can THROW.", kx, ky, 3.4) },
      {
        t: 9.1,
        fn: () => {
          this.prompt = "Bash the gray blocks (X). Cubo grabs the pieces and THROWS them at Clank!";
        },
      },
    ]);
  }

  /* ═══════════ per-step ═══════════ */
  private step(dt: number): void {
    const inp = this.input;
    if (this.screen !== "play" && this.screen !== "ending") {
      this.handleMenuInput();
      inp.endStep();
      return;
    }
    this.time += dt;
    if (this.screen === "ending") {
      this.endingT += dt;
      this.particles.update(dt);
      if (Math.floor(this.endingT * 2) !== Math.floor((this.endingT - dt) * 2)) this.particles.confetti(this.camera.x + this.rng.range(100, VW - 100), this.camera.y + 40, 30);
      inp.endStep();
      return;
    }
    // pause
    if (inp.justPressed("pause")) {
      this.setScreen("pause");
      inp.endStep();
      return;
    }
    // power card holds the world
    if (this.activeCard) {
      this.cardT -= dt;
      const anyKey = inp.justPressed("confirm") || inp.justPressed("jump") || inp.justPressed("bash");
      if (this.cardT <= 0 || (anyKey && this.cardT < 2.6)) this.dismissCard();
      inp.endStep();
      return;
    }
    if (this.god && inp.justPressed("debugSkip")) {
      this.levelComplete();
      inp.endStep();
      return;
    }
    this.levelTime += dt;
    if (!this.introSaid && this.levelTime > 1 && this.cuboPresent && this.level.cuboLine && this.level.id !== 2) {
      this.introSaid = true;
      const lines = WORLD_START_LINES[this.level.id];
      this.say("cubo", lines ? lines[0] : this.level.cuboLine, this.cubo.cx, this.cubo.body.y, 3.5);
    }
    if (this.level.id === 2) this.introSaid = true;

    // controls
    const cut = this.cutscene;
    this.hero.ctl = cut ? emptyHeroControls() : this.readHeroControls();
    if (this.cuboPresent) {
      if (cut) this.cubo.ctl = emptyCuboControls();
      else if (this.twoPlayer) this.cubo.ctl = this.readCuboControls();
      else this.brain.update(this, this.cubo, dt);
    }
    if (!cut && this.hero.activeSlots.length) {
      if (inp.justPressed("prev")) this.hero.cycle(-1);
      if (inp.justPressed("next")) this.hero.cycle(1);
      for (let i = 1; i <= 9; i++) if (inp.justPressed(`slot${i}` as Action)) this.hero.selectSlot(i - 1);
    }

    // slow time
    if (this.hero.fx.slow > 0) {
      this.hero.fx.slow -= dt;
      this.timeScale = 0.4;
    } else this.timeScale = 1;
    const sdt = dt * this.timeScale;

    // entities — platforms rebuilt before each actor so riders see fresh rects
    const order = (e: EntityLike) => (e instanceof Mover || e.kind === "tetromino" || e.kind === "spawner" || e instanceof Enemy ? 0 : e instanceof Cubo ? 1 : e instanceof Hero ? 2 : 3);
    const list = this.ents.slice().sort((a, b) => order(a) - order(b));
    for (const e of list) {
      if (e.dead) continue;
      if (e instanceof Cubo && !this.cuboPresent) continue;
      this.rebuildPlatforms();
      e.update(this, e instanceof Hero ? dt : sdt);
    }
    this.ents = this.ents.filter((e) => !e.dead);
    if (this.ents.length > 400) this.ents = this.ents.filter((e) => !(e instanceof Projectile)).concat(this.ents.filter((e) => e instanceof Projectile).slice(-40));

    // cutscene clock
    if (cut) {
      cut.t += dt;
      while (cut.i < cut.steps.length && cut.steps[cut.i].t <= cut.t) cut.steps[cut.i++].fn();
      cut.each?.(dt);
      if (cut.t >= cut.end && cut.i >= cut.steps.length) {
        this.cutscene = null;
        this.letterboxTarget = 0;
      }
    }
    this.letterbox += (this.letterboxTarget - this.letterbox) * Math.min(1, dt * 6);

    // portal prompt (level 10 loop area)
    if (this.level.flags.finale && this.finaleStage === 0) {
      const inPortal = this.ents.some((e) => e instanceof Portal && e.active && overlaps(e.body, this.hero.body));
      const cuboIn = this.ents.some((e) => e instanceof Portal && e.active && overlaps(e.body, this.cubo.body));
      this.prompt = inPortal ? (cuboIn ? "Cubo's here — press ↑ NOW!" : "Wait for Cubo...") : null;
    }

    // clear countdown
    if (this.clearT > 0) {
      this.clearT -= dt;
      if (this.clearT <= 0) this.levelComplete();
    }
    this.camera.update(this.hero.body, this.hero.facing, dt);
    this.particles.update(dt);
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.ttl -= dt;
      if (b.ttl <= 0) this.bubbles.splice(i, 1);
      else if (b.speaker === "cubo") {
        b.x = this.cubo.cx;
        b.y = this.cubo.body.y - this.cubo.pillarH;
      } else if (b.speaker === "hero") {
        b.x = this.hero.cx;
        b.y = this.hero.body.y;
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    inp.endStep();
    this.emit(false);
  }

  private rebuildPlatforms(): void {
    this.platforms.length = 0;
    for (const e of this.ents) {
      if (e.dead) continue;
      if (e instanceof Cubo) {
        if (this.cuboPresent) this.platforms.push(e.platform());
      } else if (e instanceof Mover) this.platforms.push(e.platform());
      else if (e instanceof Enemy) {
        const p = e.platform();
        if (p) this.platforms.push(p);
      } else if (e.kind === "tetromino") this.platforms.push((e as unknown as { platform(): Platform }).platform());
    }
  }

  private readHeroControls() {
    const i = this.input;
    return {
      left: i.held("left"),
      right: i.held("right"),
      up: i.held("up"),
      down: i.held("down"),
      jump: i.held("jump"),
      jumpPressed: i.justPressed("jump"),
      jumpReleased: i.justReleased("jump"),
      bashPressed: i.justPressed("bash"),
      powerPressed: i.justPressed("power"),
      downPressed: i.justPressed("down"),
      upPressed: i.justPressed("up"),
    };
  }
  private readCuboControls() {
    const i = this.input;
    return {
      left: i.held("p2left"),
      right: i.held("p2right"),
      up: i.held("p2up"),
      down: i.held("p2down"),
      jumpPressed: i.justPressed("p2up"),
      action: i.held("p2action"),
      actionPressed: i.justPressed("p2action"),
    };
  }

  private handleMenuInput(): void {
    const i = this.input;
    if (this.screen === "select") {
      if (i.justPressed("left") || i.justPressed("p2left")) this.ui("select-left");
      if (i.justPressed("right") || i.justPressed("p2right")) this.ui("select-right");
      if (i.justPressed("up") || i.justPressed("prev")) this.ui("world-right");
      if (i.justPressed("down") || i.justPressed("next")) this.ui("world-left");
    }
    if (i.justPressed("confirm") || i.justPressed("jump")) {
      if (this.screen === "pause") this.setScreen("play");
      else this.confirm();
    }
    if (this.screen === "pause" && i.justPressed("pause")) this.setScreen("play");
    if (this.screen === "title" && i.justPressed("bash")) this.ui("continue");
  }

  private dismissCard(): void {
    this.activeCard = null;
    this.emit(true);
  }

  private levelComplete(): void {
    if (this.screen !== "play") return;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(10, this.levelNo + 1));
    writeSave(this.save);
    this.sfx("victory");
    this.prompt = null;
    this.particles.confetti(this.hero.cx, this.hero.body.y, 80);
    if (this.levelNo >= LEVELS.length) {
      this.beginEnding();
      return;
    }
    this.setScreen("clear");
  }

  /* ═══════════ render ═══════════ */
  private render(): void {
    this.lights.length = 0;
    const hud: HudState = {
      levelName: this.level.name,
      rescued: this.save.rescued,
      coins: this.save.coins,
      hearts: this.hero.hearts,
      maxHearts: this.hero.maxHearts,
      activeSlots: this.hero.activeSlots,
      selected: this.hero.selected,
      cooldowns: this.hero.cooldowns,
      passives: PASSIVES.filter((p) => this.hero.has(p)),
      touch: this.touch,
      prompt: this.prompt,
    };
    const ents = this.cuboPresent ? this.ents : this.ents.filter((e) => !(e instanceof Cubo));
    this.renderer.draw({
      level: this.level,
      map: this.map,
      camera: this.camera,
      entities: this.screen === "title" || this.screen === "select" ? ents.filter((e) => !(e instanceof Hero)) : ents,
      particles: this.particles,
      bubbles: this.bubbles,
      lights: this.lights,
      hero: this.hero,
      cubo: this.cubo,
      time: this.time + performance.now() / 1000,
      hud: (this.screen === "play" || this.screen === "pause") && !this.cutscene ? hud : { ...hud, activeSlots: [], passives: [], prompt: null },
      letterbox: this.letterbox,
      flash: this.flash,
    });
    const canvas = this.renderer.canvas;
    if (canvas.dataset.screen !== this.screen) canvas.dataset.screen = this.screen;
    const lv = String(this.levelNo);
    if (canvas.dataset.level !== lv) canvas.dataset.level = lv;
  }

  /* ═══════════ ui snapshot ═══════════ */
  snapshot(): UiSnapshot {
    return {
      screen: this.screen,
      level: this.levelNo,
      levelName: this.level.name,
      levelSubtitle: this.level.subtitle,
      hero: this.save.hero,
      muted: this.save.muted,
      twoPlayer: this.twoPlayer,
      audioUnlocked: this.synth.unlocked,
      card: this.activeCard,
      unlocked: this.save.unlocked,
      rescued: this.save.rescued.slice(),
      coins: this.save.coins,
      hasSave: hasSave() && this.save.unlocked > 1,
      selectIndex: this.selectIndex,
      introLine: this.level.introLine,
      cuboLine: this.level.cuboLine,
    };
  }
  private emit(force: boolean): void {
    const snap = this.snapshot();
    const key = JSON.stringify(snap);
    if (!force && key === this.lastSnapshot) return;
    this.lastSnapshot = key;
    for (const l of this.listeners) l(snap);
  }
  get selectedWorld(): number {
    return this.selectWorld;
  }

  /* ═══════════ debug ═══════════ */
  debugApi() {
    return {
      screen: () => this.screen,
      level: () => this.levelNo,
      hero: () => ({ x: this.hero.body.x, y: this.hero.body.y, vx: this.hero.vx, vy: this.hero.vy, hearts: this.hero.hearts, powers: Array.from(this.hero.powers) }),
      cubo: () => ({ x: this.cubo.body.x, y: this.cubo.body.y, state: this.brain.state, present: this.cuboPresent }),
      skipLevel: () => this.levelComplete(),
      raw: () => this as unknown,
      teleport: (x: number, y: number) => {
        this.hero.body.x = x;
        this.hero.body.y = y;
        this.hero.vx = 0;
        this.hero.vy = 0;
        this.camera.snapTo(this.hero.body);
      },
      audioState: () => this.synth.state(),
      save: () => ({ ...this.save }),
      entities: () => this.ents.length,
      finale: () => ({
        stage: this.finaleStage,
        cutscene: !!this.cutscene,
        cutT: this.cutscene?.t ?? -1,
        shells: this.ents.filter((e) => e instanceof Shell && !e.dead).length,
        shellsCracked: this.shellsCracked,
        boss: this.ents.some((e) => e.kind === "boss" && !e.dead),
        blocks: this.ents.filter((e) => e instanceof BlockPickup && !e.dead).length,
        holding: !!this.cubo.holdingBlock,
        kinds: this.ents.map((e) => e.kind),
      }),
    };
  }
}

export type DebugApi = ReturnType<Game["debugApi"]>;
export { VW, VH };
export type { Actor };
