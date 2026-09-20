import { FRIENDS, FRIEND_BY_ID } from "../worlds/friends";
import {
  PHYS,
  type HeroKind,
  type FriendId,
  type PowerId,
  type SfxName,
} from "../engine/types";
import { buildWorld, platformAt, type Point, type World3D } from "./worlds";
export type Difficulty = "adventure" | "challenge";
export type Save = {
  version: 2;
  hero: HeroKind;
  difficulty: Difficulty;
  world: number;
  unlocked: number;
  rescued: FriendId[];
  coins: number;
  stars: string[];
  finished: boolean;
  checkpoint: boolean;
  settings: {
    muted: boolean;
    music: number;
    effects: number;
    quality: "high" | "low";
  };
};
export const SAVE_KEY = "tolley-portal-hoppers-3d-v2";
export const newSave = (
  hero: HeroKind = "frog",
  difficulty: Difficulty = "challenge",
): Save => ({
  version: 2,
  hero,
  difficulty,
  world: 1,
  unlocked: 1,
  rescued: [],
  coins: 0,
  stars: [],
  finished: false,
  checkpoint: false,
  settings: { muted: false, music: 0.7, effects: 0.8, quality: "high" },
});
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function readSave(raw?: string | null): Save | null {
  try {
    const text =
      raw === undefined
        ? typeof localStorage !== "undefined"
          ? localStorage.getItem(SAVE_KEY)
          : null
        : raw;
    if (!text) return null;
    const s = JSON.parse(text);
    if (s.version !== 2) return null;
    const d = newSave(
      ["frog", "fox", "cat"].includes(s.hero) ? s.hero : "frog",
      s.difficulty === "adventure" ? "adventure" : "challenge",
    );
    d.world = Number.isInteger(s.world) ? clamp(s.world, 1, 10) : 1;
    d.unlocked = Number.isInteger(s.unlocked)
      ? clamp(s.unlocked, d.world, 10)
      : d.world;
    d.rescued = Array.isArray(s.rescued)
      ? [
          ...new Set<FriendId>(
            s.rescued.filter((x: FriendId) => FRIENDS.some((f) => f.id === x)),
          ),
        ]
      : [];
    d.coins = Number.isFinite(s.coins)
      ? clamp(Math.floor(s.coins), 0, 999999)
      : 0;
    d.stars = Array.isArray(s.stars)
      ? [
          ...new Set<string>(
            s.stars.filter(
              (x: unknown) =>
                typeof x === "string" && /^star-(10|[1-9])-[12]$/.test(x),
            ),
          ),
        ]
      : [];
    d.finished = s.finished === true;
    d.checkpoint = s.checkpoint === true;
    if (s.settings) {
      d.settings = {
        muted: s.settings.muted === true,
        music: Number.isFinite(s.settings.music)
          ? clamp(s.settings.music, 0, 1)
          : 0.7,
        effects: Number.isFinite(s.settings.effects)
          ? clamp(s.settings.effects, 0, 1)
          : 0.8,
        quality: s.settings.quality === "low" ? "low" : "high",
      };
    }
    return d;
  } catch {
    return null;
  }
}
export type Controls = {
  x: number;
  z: number;
  jump: boolean;
  heldJump: boolean;
  bash: boolean;
  interact: boolean;
  power: boolean;
  cycle: boolean;
  boost: boolean;
};
export const emptyControls = (): Controls => ({
  x: 0,
  z: 0,
  jump: false,
  heldJump: false,
  bash: false,
  interact: false,
  power: false,
  cycle: false,
  boost: false,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export class PortalGame {
  world: World3D;
  position: Point;
  velocity = { x: 0, y: 0, z: 0 };
  yaw = Math.PI;
  cameraYaw = 0;
  cameraPitch = 0.48;
  grounded = true;
  jumps = 0;
  paused = true;
  time = 0;
  worldTime = 0;
  hearts: number;
  invulnerable = 0;
  attack = 0;
  attackCooldown = 0;
  powerTime = 0;
  powerCooldown = 0;
  active: PowerId | null = null;
  message = "";
  messageTime = 0;
  rescue: FriendId | null = null;
  orbHits = 0;
  cageHits: Record<string, number> = {};
  collected = new Set<string>();
  checkpoint: Point;
  pillar: Point | null = null;
  pillarTime = 0;
  boostCooldown = 0;
  cubo: Point;
  worldVersion = 0;
  saveFailed = false;
  bossHP = 0;
  bossPhase: "idle" | "warn" | "wave" | "rest" = "idle";
  bossTimer = 2;
  waveRadius = 0;
  bossHit = 0;
  effects: {
    id: number;
    kind: "coin" | "bash" | "rescue" | "jump" | "hurt";
    x: number;
    y: number;
    z: number;
    age: number;
  }[] = [];
  private effectId = 0;
  private footstep = 0;
  private saveTimer = 0;
  private coyote = 0.1;
  private jumpBuffer = 0;
  private lastPlatform: string | null = null;
  private jumpCharge = 0;
  private charging = false;
  sound: ((s: SfxName) => void) | null = null;
  constructor(public saveData: Save) {
    this.world = buildWorld(saveData.world);
    this.position = { ...this.world.start };
    this.checkpoint = saveData.checkpoint
      ? {
          x: this.world.checkpoint.x,
          y: this.world.checkpoint.y,
          z: this.world.checkpoint.z,
        }
      : { ...this.position };
    this.position = { ...this.checkpoint };
    this.cubo = {
      x: this.position.x + 1.7,
      y: this.position.y + 1,
      z: this.position.z + 1.3,
    };
    this.hearts = this.maxHearts;
    this.resetBoss();
    this.active =
      this.powers.find((p) => !FRIENDS.find((f) => f.power === p)?.passive) ??
      null;
  }
  setSound(sound: ((s: SfxName) => void) | null) {
    this.sound = sound;
  }
  configure(settings: Save["settings"]) {
    this.saveData.settings = { ...settings };
  }
  get maxHearts() {
    return this.saveData.difficulty === "challenge" ? 4 : 6;
  }
  get powers() {
    return this.saveData.rescued.map((f) => FRIEND_BY_ID[f].power);
  }
  has(p: PowerId) {
    return this.powers.includes(p);
  }
  get hasCubo() {
    return this.saveData.world >= 2;
  }
  get speedTime() {
    return (
      this.worldTime * (this.saveData.difficulty === "challenge" ? 1.3 : 1)
    );
  }
  get portalOpen() {
    return (
      this.orbHits >= 3 &&
      this.world.cages.every((c) => this.saveData.rescued.includes(c.friend)) &&
      this.bossHP === 0
    );
  }
  say(message: string) {
    this.message = message;
    this.messageTime = 5;
  }
  sfx(s: SfxName) {
    this.sound?.(s);
  }
  effect(
    kind: "coin" | "bash" | "rescue" | "jump" | "hurt",
    p = this.position,
  ) {
    this.effects.push({ id: ++this.effectId, kind, ...p, age: 0 });
  }
  save() {
    try {
      if (typeof localStorage !== "undefined")
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
      this.saveFailed = false;
    } catch {
      this.saveFailed = true;
    }
  }
  resetBoss() {
    this.bossHP = this.world.boss ? (this.world.id === 10 ? 12 : 9) : 0;
    this.bossPhase = "idle";
    this.bossTimer = 2;
    this.waveRadius = 0;
  }
  start() {
    this.paused = false;
    this.say(this.world.intro);
    this.save();
  }
  resume() {
    this.paused = false;
    this.rescue = null;
  }
  pause() {
    this.paused = true;
    this.save();
  }
  resetCheckpoint() {
    this.position = { ...this.checkpoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.hearts = this.maxHearts;
    this.invulnerable = 2;
    this.grounded = true;
    this.jumps = 0;
    this.charging = false;
    this.jumpCharge = 0;
    this.cubo = {
      x: this.position.x + 1.7,
      y: this.position.y + 1,
      z: this.position.z + 1,
    };
    this.sfx("respawn");
    this.say("Cubo saved your spot. Take a breath and try again!");
  }
  damage() {
    if (
      this.invulnerable > 0 ||
      (this.powerTime > 0 && ["bubble", "dash"].includes(this.active ?? ""))
    )
      return;
    if (this.has("shield") && this.powerCooldown <= 0) {
      this.powerCooldown = 7;
      this.invulnerable = 1;
      this.sfx("pop");
      return;
    }
    this.hearts--;
    this.invulnerable = 1.5;
    this.effect("hurt");
    this.sfx("hit");
    if (this.hearts <= 0) this.resetCheckpoint();
  }
  cyclePower() {
    const available = FRIENDS.filter(
      (f) => !f.passive && this.saveData.rescued.includes(f.id),
    ).map((f) => f.power);
    if (!available.length) {
      this.say("Rescue your friends to fill the Power Wheel!");
      return;
    }
    this.active =
      available[(available.indexOf(this.active!) + 1) % available.length];
    this.say(
      `${FRIENDS.find((f) => f.power === this.active)!.powerName} · Press C to use`,
    );
    this.sfx("select");
  }
  usePower() {
    if (!this.active) {
      this.say("Bash a rescue cage three times to earn a friend’s power.");
      return;
    }
    if (this.powerCooldown > 0) return;
    this.powerCooldown = 5;
    this.powerTime = 3;
    this.sfx("powerup");
    if (this.active === "rocket") {
      this.velocity.y = 18;
      this.grounded = false;
      this.sfx("boost");
    }
    if (this.active === "pound") {
      this.velocity.y = -23;
      this.bash(4, 3);
      this.sfx("stomp");
    }
    if (this.active === "megaPunch") this.bash(5, 3);
    if (this.active === "freeze") {
      for (const e of this.world.enemies)
        if (distance(e, this.position) < 9) e.stun = 5;
      this.sfx("freeze");
    }
    if (this.active === "bubble") {
      this.velocity.y = Math.max(this.velocity.y, 6);
      this.grounded = false;
      this.sfx("pop");
    }
    this.say(`${FRIENDS.find((f) => f.power === this.active)!.powerName}!`);
  }
  boost() {
    if (!this.hasCubo) {
      this.say("You’ll meet Cubo in Star World!");
      return;
    }
    if (this.boostCooldown > 0) return;
    this.boostCooldown = 6;
    this.pillar = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };
    this.pillarTime = 2.5;
    this.velocity.y = 17;
    this.grounded = false;
    this.sfx("boost");
    this.say("Cubo: Up you go! Aim for that high ledge!");
  }
  bash(radius = 2.65, hits = 1) {
    if (this.attackCooldown > 0) return;
    this.attack = 0.42;
    this.attackCooldown = 0.42;
    this.sfx("bash");
    this.effect("bash");
    for (const c of this.world.cages) {
      if (
        this.saveData.rescued.includes(c.friend) ||
        distance(c, this.position) > radius ||
        Math.abs(c.y - this.position.y) > 2.5
      )
        continue;
      this.cageHits[c.friend] = (this.cageHits[c.friend] ?? 0) + hits;
      this.sfx("crack");
      if (this.cageHits[c.friend] >= 3) {
        this.saveData.rescued.push(c.friend);
        const f = FRIEND_BY_ID[c.friend];
        if (!f.passive) this.active = f.power;
        this.sfx("powerup");
        this.effect("rescue", c);
        this.rescue = c.friend;
        this.paused = true;
        this.hearts = this.maxHearts;
        this.save();
      } else
        this.say(
          `${FRIEND_BY_ID[c.friend].name}’s cage · ${3 - this.cageHits[c.friend]} more bash${this.cageHits[c.friend] === 1 ? "es" : ""}!`,
        );
    }
    if (
      distance(this.position, this.world.orb) < radius &&
      Math.abs(this.position.y - this.world.orb.y) < 2.6 &&
      this.orbHits < 3
    ) {
      this.orbHits++;
      this.sfx(this.orbHits === 3 ? "portal" : "crack");
      this.say(
        this.orbHits === 3
          ? "The orb is awake! Rescue your friends, then hop through the portal."
          : `Portal orb · ${3 - this.orbHits} more bashes!`,
      );
    }
    for (const e of this.world.enemies) {
      if (
        e.hp > 0 &&
        distance(this.position, e) < radius &&
        Math.abs(this.position.y - e.y) < 2.4
      ) {
        e.hp -= hits;
        e.stun = 1;
        e.flash = 0.3;
        this.sfx("stomp");
        if (e.hp <= 0) {
          this.saveData.coins += 3;
          this.effect("coin", e);
        }
      }
    }
    const boss = this.world.platforms[12];
    if (
      this.bossHP > 0 &&
      distance(this.position, { ...boss, z: boss.z + 1 }) < 4 &&
      this.bossPhase === "rest" &&
      this.bossHit <= 0
    ) {
      this.bossHP = Math.max(0, this.bossHP - hits);
      this.bossHit = 0.65;
      this.sfx("stomp");
      if (!this.bossHP) {
        this.sfx("victory");
        this.effect("rescue", boss);
        this.say(
          this.world.boss === "clank"
            ? "Clank’s cage machine is off! Bring everyone home through the portal!"
            : "You did it! The portal is almost ready!",
        );
      }
    }
  }
  nextWorld() {
    if (!this.portalOpen) {
      this.say(
        this.bossHP
          ? "Dodge the glowing rings. Bonk the boss while it’s resting!"
          : this.world.cages.some(
                (c) => !this.saveData.rescued.includes(c.friend),
              )
            ? "A friend still needs rescuing! Follow the cage marker."
            : "Bash the glowing orb three times to open the portal!",
      );
      return false;
    }
    this.sfx("portal");
    this.saveData.checkpoint = false;
    if (this.saveData.world === 10) {
      this.saveData.finished = true;
      this.paused = true;
      this.sfx("victory");
      this.save();
      return true;
    }
    this.saveData.world++;
    this.saveData.unlocked = Math.max(
      this.saveData.unlocked,
      this.saveData.world,
    );
    this.loadWorld();
    return true;
  }
  loadWorld() {
    this.world = buildWorld(this.saveData.world);
    this.worldVersion++;
    this.position = { ...this.world.start };
    this.checkpoint = { ...this.position };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.hearts = this.maxHearts;
    this.grounded = true;
    this.orbHits = 0;
    this.cageHits = {};
    this.collected.clear();
    this.worldTime = 0;
    this.resetBoss();
    this.say(this.world.cuboLine || this.world.intro);
    this.save();
  }
  tick(dt: number, c: Controls) {
    if (this.paused) return;
    dt = Math.min(dt, 0.04);
    this.time += dt;
    const slow = this.powerTime > 0 && this.active === "slowTime" ? 0.35 : 1;
    const prev = this.speedTime;
    this.worldTime += dt * slow;
    for (const key of [
      "invulnerable",
      "attack",
      "attackCooldown",
      "powerTime",
      "powerCooldown",
      "messageTime",
      "pillarTime",
      "boostCooldown",
      "bossHit",
    ] as const)
      this[key] = Math.max(0, this[key] - dt);
    if (this.pillarTime === 0) this.pillar = null;
    this.effects = this.effects.filter((e) => {
      e.age += dt;
      return e.age < 1.3;
    });
    if (c.cycle) this.cyclePower();
    if (c.power) this.usePower();
    if (c.boost) this.boost();
    if (c.bash) this.bash();
    if (this.paused) return;
    if (c.interact) {
      if (distance(this.position, this.world.portal) < 4) this.nextWorld();
      else if (
        this.world.pipes.length &&
        distance(this.position, this.world.pipes[0]) < 2.3
      ) {
        const p = this.world.pipes[1];
        this.position = { x: p.x, y: p.y + 1, z: p.z + 2 };
        this.sfx("portal");
        this.say("Pipe shortcut!");
      } else this.boost();
    }
    // Platform carry is applied before motion so moving platforms remain reliable at low frame rates.
    if (this.grounded && this.lastPlatform) {
      const p = this.world.platforms.find((p) => p.id === this.lastPlatform);
      if (p?.moving)
        this.position.x +=
          platformAt(p, this.speedTime).x - platformAt(p, prev).x;
    }
    const len = Math.hypot(c.x, c.z);
    const nx = c.x / Math.max(1, len),
      nz = c.z / Math.max(1, len);
    const running =
      this.powerTime > 0 && ["speed", "dash"].includes(this.active ?? "");
    const speed = (PHYS.runMax / 30) * (running ? 1.65 : 1);
    this.velocity.x = nx * speed;
    this.velocity.z = nz * speed;
    if (len > 0.1) this.yaw = Math.atan2(nx, nz);
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = c.jump ? 0.15 : Math.max(0, this.jumpBuffer - dt);
    // The original stationary hold-and-release Ultra Jump, alongside ordinary running jumps.
    if (c.jump && c.heldJump && this.grounded && len < 0.1) {
      this.charging = true;
      this.jumpCharge = 0;
      this.jumpBuffer = 0;
    }
    if (this.charging) {
      if (c.heldJump && this.grounded && len < 0.1) {
        this.jumpCharge += dt;
        this.jumpBuffer = 0;
        if (this.jumpCharge >= 0.5 && this.jumpCharge - dt < 0.5) {
          this.sfx("ultraCharge");
          this.say("Ultra jump charged! Release jump to soar.");
        }
      } else {
        if (this.grounded) {
          this.velocity.y =
            this.jumpCharge >= 0.5 ? -PHYS.ultraV / 55 : -PHYS.jumpV / 55;
          this.jumps = 1;
          this.grounded = false;
          this.coyote = 0;
          this.jumpBuffer = 0;
          this.sfx(this.jumpCharge >= 0.5 ? "ultra" : "jump");
          this.effect("jump");
        }
        this.charging = false;
        this.jumpCharge = 0;
      }
    }
    if (
      this.jumpBuffer > 0 &&
      (this.coyote > 0 || (this.has("doubleJump") && this.jumps < 2))
    ) {
      this.velocity.y = -PHYS.jumpV / 55;
      this.jumps++;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.sfx("jump");
      this.effect("jump");
    }
    const old = { ...this.position };
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    const gravity = PHYS.gravity / 55;
    this.velocity.y -= gravity * dt;
    if (this.has("glide") && c.heldJump && this.velocity.y < 0)
      this.velocity.y = Math.max(-2.3, this.velocity.y);
    if (this.powerTime > 0 && this.active === "bubble")
      this.velocity.y = Math.max(-1.5, this.velocity.y);
    this.position.y += this.velocity.y * dt;
    this.grounded = false;
    // Top-surface landing and side walls use the same rounded-island footprint as the renderer.
    const radius = this.powerTime > 0 && this.active === "shrink" ? 0.23 : 0.4;
    for (const p of this.world.platforms) {
      const at = platformAt(p, this.speedTime);
      const r = Math.min(p.w, p.d) * 0.29;
      const qx = Math.max(0, Math.abs(this.position.x - at.x) - (p.w / 2 - r)),
        qz = Math.max(0, Math.abs(this.position.z - at.z) - (p.d / 2 - r));
      const inside = Math.hypot(qx, qz) < r + radius * 0.25;
      if (!inside) continue;
      if (
        this.velocity.y <= 0 &&
        old.y >= at.y - 0.18 &&
        this.position.y <= at.y
      ) {
        this.position.y = at.y;
        this.velocity.y = 0;
        this.grounded = true;
        this.jumps = 0;
        this.lastPlatform = p.id;
        if (p.spring && c.heldJump) {
          this.velocity.y = 16;
          this.grounded = false;
          this.sfx("boing");
          this.effect("jump");
        } else if (old.y - at.y > 0.08) this.sfx("boing");
      } else if (
        this.position.y < at.y - 0.2 &&
        this.position.y + 1.8 > at.y - 2.5
      ) {
        if (Math.abs(old.x - at.x) >= p.w / 2 - 0.1) this.position.x = old.x;
        if (Math.abs(old.z - at.z) >= p.d / 2 - 0.1) this.position.z = old.z;
        if (this.has("wallCling") && c.heldJump && this.velocity.y < 0) {
          this.velocity.y = -1;
          this.jumps = Math.min(this.jumps, 1);
        }
      }
    }
    // Water World's low sea is swimmable: repeated jump swims up to the next island.
    if (
      this.world.id === 4 &&
      this.position.y < -0.45 &&
      this.position.y > -5 &&
      Math.abs(this.position.x) < 17 &&
      this.position.z < 16 &&
      this.position.z > -87
    ) {
      this.velocity.y = Math.max(this.velocity.y, -1.5);
      if (c.jump) {
        this.velocity.y = 10;
        this.sfx("splash");
      }
      this.jumps = 0;
    }
    if (this.position.y < (this.world.id === 4 ? -5 : -12)) {
      this.resetCheckpoint();
      return;
    }
    this.position.x = clamp(this.position.x, -24, 24);
    if (this.grounded && len > 0.3) {
      this.footstep += dt;
      if (this.footstep > 0.33) {
        this.footstep = 0;
        this.sfx("step");
      }
    }
    for (const coin of this.world.coins) {
      if (this.collected.has(coin.id)) continue;
      const r = this.has("magnet") ? 4.7 : 1.1;
      if (
        distance(this.position, coin) < r &&
        Math.abs(this.position.y + 0.8 - coin.y) < 2
      ) {
        this.collected.add(coin.id);
        this.saveData.coins++;
        this.sfx("coin");
        this.effect("coin", coin);
      }
    }
    for (const star of this.world.stars)
      if (
        !this.saveData.stars.includes(star.id) &&
        distance(this.position, star) < 1.2 &&
        Math.abs(this.position.y + 0.8 - star.y) < 1.8
      ) {
        this.saveData.stars.push(star.id);
        this.sfx("powerup");
        this.effect("rescue", star);
        this.say("Secret star found! There are two in every world.");
        this.save();
      }
    const cp = this.world.checkpoint;
    if (
      !this.saveData.checkpoint &&
      distance(this.position, cp) < 2.8 &&
      Math.abs(this.position.y - cp.y) < 1
    ) {
      this.saveData.checkpoint = true;
      this.checkpoint = { x: cp.x, y: cp.y, z: cp.z };
      this.hearts = this.maxHearts;
      this.sfx("powerup");
      this.say("Checkpoint! Your friends and powers are safe.");
      this.save();
    }
    for (const h of this.world.hazards) {
      const live = Math.sin(this.speedTime * 2 + h.phase) > 0.25;
      if (
        live &&
        distance(this.position, h) < 1 &&
        Math.abs(this.position.y - h.y) < 0.5
      )
        this.damage();
    }
    for (const e of this.world.enemies) {
      e.stun = Math.max(0, e.stun - dt);
      e.flash = Math.max(0, e.flash - dt);
      if (e.hp <= 0 || e.stun > 0) continue;
      e.timer -=
        dt * slow * (this.saveData.difficulty === "challenge" ? 1.35 : 1);
      const d = distance(this.position, e);
      if (e.phase === "patrol") {
        e.x = e.homeX + Math.sin(this.worldTime + e.homeZ) * 1.4;
        if (d < 4.5 && Math.abs(this.position.y - e.y) < 2.2) {
          e.phase = "warn";
          e.timer = 0.85;
          e.dx = (this.position.x - e.x) / Math.max(0.01, d);
          e.dz = (this.position.z - e.z) / Math.max(0.01, d);
        }
      } else if (e.phase === "warn" && e.timer <= 0) {
        e.phase = "dash";
        e.timer = 0.45;
        this.sfx("roar");
      } else if (e.phase === "dash") {
        e.x += e.dx * 6 * dt * slow;
        e.z += e.dz * 6 * dt * slow;
        if (e.timer <= 0) {
          e.phase = "rest";
          e.timer = 1.4;
        }
      } else if (e.phase === "rest" && e.timer <= 0) {
        e.phase = "patrol";
        e.x = e.homeX;
        e.z = e.homeZ;
      }
      if (
        d < 1 &&
        this.position.y > e.y + 0.6 &&
        this.position.y < e.y + 1.6 &&
        this.velocity.y < 0
      ) {
        e.hp--;
        e.stun = 1;
        this.velocity.y = 9;
        this.sfx("stomp");
        this.effect("bash", e);
      } else if (d < 1 && Math.abs(this.position.y - e.y) < 0.6) this.damage();
    }
    this.tickBoss(dt * slow);
    const target = {
      x: this.position.x - Math.sin(this.yaw + 0.7) * 1.8,
      y: this.position.y + 1.2,
      z: this.position.z - Math.cos(this.yaw + 0.7) * 1.8,
    };
    for (const axis of ["x", "y", "z"] as const)
      this.cubo[axis] += (target[axis] - this.cubo[axis]) * Math.min(1, dt * 4);
    this.saveTimer += dt;
    if (this.saveTimer > 5) {
      this.saveTimer = 0;
      this.save();
    }
  }
  tickBoss(dt: number) {
    if (!this.bossHP) return;
    const arena = this.world.platforms[12];
    if (distance(this.position, arena) > 14) return;
    this.bossTimer -= dt * (this.saveData.difficulty === "challenge" ? 1.2 : 1);
    if (this.bossPhase === "idle" && this.bossTimer <= 0) {
      this.bossPhase = "warn";
      this.bossTimer = 1.2;
      this.say("Glowing ring! Jump over it, then bash while the boss rests.");
      this.sfx(this.world.boss === "whistler" ? "whistle" : "roar");
    } else if (this.bossPhase === "warn" && this.bossTimer <= 0) {
      this.bossPhase = "wave";
      this.bossTimer = 2;
      this.waveRadius = 0;
    } else if (this.bossPhase === "wave") {
      this.waveRadius += dt * (this.bossHP < 5 ? 9 : 7);
      if (
        Math.abs(distance(this.position, arena) - this.waveRadius) < 0.7 &&
        this.position.y < arena.y + 0.8
      )
        this.damage();
      if (this.bossTimer <= 0) {
        this.bossPhase = "rest";
        this.bossTimer = this.saveData.difficulty === "challenge" ? 2.6 : 4;
      }
    } else if (this.bossPhase === "rest" && this.bossTimer <= 0) {
      this.bossPhase = "idle";
      this.bossTimer = 0.8;
    }
  }
  objective() {
    const pending = this.world.cages.find(
      (c) => !this.saveData.rescued.includes(c.friend),
    );
    if (pending)
      return `Rescue ${FRIEND_BY_ID[pending.friend].name} · bash the cage 3 times`;
    if (this.bossHP)
      return `Outsmart ${this.world.boss === "clank" ? "Captain Clank" : this.world.boss === "sultan" ? "the Sugar Sultan" : "the Whistler"}`;
    if (this.orbHits < 3)
      return `Find the portal orb · ${3 - this.orbHits} bashes to wake it`;
    return "Portal open! Bring your friends home.";
  }
  snapshot() {
    return {
      world: this.world.id,
      worldVersion: this.worldVersion,
      hearts: this.hearts,
      coins: this.saveData.coins,
      rescued: [...this.saveData.rescued],
      stars: this.saveData.stars.length,
      objective: this.objective(),
      message: this.messageTime > 0 ? this.message : "",
      active: this.active,
      powerCooldown: Math.ceil(this.powerCooldown),
      rescue: this.rescue,
      finished: this.saveData.finished,
      saveFailed: this.saveFailed,
      orbHits: this.orbHits,
      bossHP: this.bossHP,
      portalOpen: this.portalOpen,
    };
  }
}
