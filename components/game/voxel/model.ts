/**
 * VoxelGame — the whole simulation for Portal Hoppers: Blocky Worlds. No React, no Three.
 * React reads `snapshot()`; the renderer reads the public fields directly every frame.
 */
import { FRIENDS, FRIEND_BY_ID } from "../worlds/friends";
import type { FriendId, PowerId, SfxName } from "../engine/types";
import {
  B,
  CUBO_SIZE,
  HERO,
  PHYS,
  clamp,
  dist2,
  dist3,
  emptyControls,
  type AimHit,
  type Controls,
  type DoorDef,
  type Entity,
  type Snapshot,
  type Vec3,
} from "./types";
import { VoxelGrid, type WorldDef } from "./grid";
import { sweep, volumeFree, type DynBody } from "./physics";
import { newSave, writeSave, type Save } from "./save";
import { LAST_WORLD, WORLDS, worldFor } from "./worlds";

export { emptyControls, newSave };
export type { Controls, Save };

type Effect = { id: number; kind: "coin" | "bash" | "rescue" | "jump" | "hurt" | "key" | "switch"; x: number; y: number; z: number; age: number };
type CageState = { friend: FriendId; at: Vec3; hp: number; max: number; armor?: string };
type Timed = { t: number; id: number };

const ACTIVE_POWERS: PowerId[] = ["rocket", "pound", "megaPunch", "freeze", "bubble", "dash", "speed", "shrink", "slowTime"];

export class VoxelGame {
  def: WorldDef;
  grid: VoxelGrid;
  position: Vec3;
  velocity: Vec3 = { x: 0, y: 0, z: 0 };
  yaw = 0; // facing +z, the direction every world runs
  cameraYaw = Math.PI;
  cameraPitch = 0.42;
  grounded = true;
  groundBlock: number = B.air;
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
  rocketCooldown = 0;
  active: PowerId | null = null;
  stamina: number = PHYS.glideStamina;
  message = "";
  messageTime = 0;
  rescue: FriendId | null = null;
  cages: CageState[];
  collected = new Set<string>();
  keys: string[];
  switches = new Set<string>();
  doorsOpen = new Set<string>();
  checkpointIndex: number;
  checkpoint: Vec3;
  crumbling = new Map<number, Timed>();
  regrowing = new Map<number, Timed>();
  cubo: DynBody = { id: "cubo", x: 0, y: 0, z: 0, hw: CUBO_SIZE / 2, h: CUBO_SIZE, hd: CUBO_SIZE / 2, dx: 0, dy: 0, dz: 0, soft: true };
  cuboJoined = false;
  lift: "idle" | "grow" | "hold" | "shrink" = "idle";
  liftTime = 0;
  liftCooldown = 0;
  bossHP = 0;
  bossMax = 0;
  bossName: string | null = null;
  worldVersion = 0;
  saveFailed = false;
  effects: Effect[] = [];
  aim: AimHit = { point: { x: 0, y: 0, z: 0 }, dist: 0, kind: "none", id: null };
  sound: ((s: SfxName) => void) | null = null;
  private effectId = 0;
  private footstep = 0;
  private saveTimer = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumpCharge = 0;
  private charging = false;
  private bounceLevel = 0;
  groundBody: DynBody | null = null;
  private touching = new Set<number>();
  private ceilingToast = 0;
  private hint = "";
  constructor(public saveData: Save) {
    this.def = worldFor(saveData.world);
    this.grid = new VoxelGrid(this.def.grid.w, this.def.grid.h, this.def.grid.d);
    this.grid.data.set(this.def.grid.data);
    this.keys = saveData.keys.filter((k) => this.def.entities.some((e) => e.kind === "key" && e.id === k));
    for (const k of this.keys) this.collected.add(k);
    this.cages = this.def.entities
      .filter((e): e is Extract<Entity, { kind: "cage" }> => e.kind === "cage")
      .map((c) => ({ friend: c.friend, at: c.at, hp: this.cageMax, max: this.cageMax, armor: c.armor }));
    const cps = this.checkpoints();
    this.checkpointIndex = clamp(saveData.checkpoint, 0, cps.length);
    this.checkpoint = this.checkpointIndex > 0 ? { ...cps[this.checkpointIndex - 1].at } : { ...this.def.start };
    this.position = { ...this.checkpoint };
    this.hearts = this.maxHearts;
    this.cuboJoined = saveData.world >= 2;
    this.placeCubo();
    this.resetBoss();
    for (const d of this.def.doors) if (d.boss && this.bossHP === 0) this.openDoor(d, true);
    this.active = this.powers.find((p) => ACTIVE_POWERS.includes(p)) ?? null;
  }
  /* ── derived ─────────────────────────────────────────────────────────── */
  get world() {
    return this.def;
  }
  get challenge() {
    return this.saveData.difficulty === "challenge";
  }
  get maxHearts() {
    return this.challenge ? 3 : 5;
  }
  get cageMax() {
    return this.challenge ? 8 : 6;
  }
  get iframes() {
    return this.challenge ? 0.8 : 1;
  }
  get powers() {
    return this.saveData.rescued.map((f) => FRIEND_BY_ID[f].power);
  }
  has(p: PowerId) {
    return this.powers.includes(p);
  }
  get hasCubo() {
    return this.cuboJoined;
  }
  get keysNeeded() {
    return this.def.entities.filter((e) => e.kind === "key").length;
  }
  get half() {
    return this.powerTime > 0 && this.active === "shrink" ? 0.23 : HERO.half;
  }
  get height() {
    return this.powerTime > 0 && this.active === "shrink" ? 0.9 : HERO.height;
  }
  get portalOpen() {
    return this.keys.length >= this.keysNeeded && this.cages.every((c) => this.saveData.rescued.includes(c.friend)) && this.bossHP === 0;
  }
  get bodies(): DynBody[] {
    return this.hasCubo ? [this.cubo] : [];
  }
  checkpoints() {
    return this.def.entities.filter((e): e is Extract<Entity, { kind: "checkpoint" }> => e.kind === "checkpoint").sort((a, b) => a.index - b.index);
  }
  entities<K extends Entity["kind"]>(kind: K) {
    return this.def.entities.filter((e): e is Extract<Entity, { kind: K }> => e.kind === kind);
  }
  say(message: string, seconds = 5) {
    this.message = message;
    this.messageTime = seconds;
  }
  sfx(s: SfxName) {
    this.sound?.(s);
  }
  effect(kind: Effect["kind"], p: Vec3 = this.position) {
    this.effects.push({ id: ++this.effectId, kind, x: p.x, y: p.y, z: p.z, age: 0 });
  }
  setSound(sound: ((s: SfxName) => void) | null) {
    this.sound = sound;
  }
  configure(settings: Save["settings"]) {
    this.saveData.settings = { ...settings };
  }
  save() {
    this.saveData.keys = [...this.keys];
    this.saveData.checkpoint = this.checkpointIndex;
    this.saveFailed = !writeSave(this.saveData);
  }
  /* ── lifecycle ───────────────────────────────────────────────────────── */
  start() {
    this.paused = false;
    this.say(this.def.intro, 7);
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
  resetBoss() {
    const boss = this.entities("boss")[0];
    this.bossHP = boss ? 40 : 0;
    this.bossMax = this.bossHP;
    this.bossName = boss ? boss.type : null;
  }
  placeCubo() {
    this.cubo.x = this.position.x - Math.sin(this.yaw) * 1.8;
    this.cubo.z = this.position.z - Math.cos(this.yaw) * 1.8;
    this.cubo.y = this.position.y;
    this.cubo.h = CUBO_SIZE;
    this.lift = "idle";
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
    this.stamina = PHYS.glideStamina;
    this.saveData.coins = Math.max(0, this.saveData.coins - 10);
    this.placeCubo();
    this.sfx("respawn");
    this.say(this.hasCubo ? "Cubo saved your spot. Take a breath and try again!" : "Back to the checkpoint. Try again!");
  }
  damage(amount = 1) {
    if (this.invulnerable > 0 || (this.powerTime > 0 && (this.active === "bubble" || this.active === "dash"))) return;
    if (this.has("shield") && this.powerCooldown <= 0) {
      this.powerCooldown = 7;
      this.invulnerable = 1;
      this.sfx("pop");
      return;
    }
    this.hearts -= amount;
    this.invulnerable = this.iframes;
    this.effect("hurt");
    this.sfx("hit");
    if (this.hearts <= 0) this.resetCheckpoint();
  }
  /* ── doors, switches, keys ───────────────────────────────────────────── */
  openDoor(d: DoorDef, silent = false) {
    if (this.doorsOpen.has(d.id)) return;
    this.doorsOpen.add(d.id);
    for (const c of d.cells) this.grid.set(c.x, c.y, c.z, B.air);
    if (!silent) {
      this.sfx("portal");
      this.effect("switch", d.cells[0] ? { x: d.cells[0].x + 0.5, y: d.cells[0].y, z: d.cells[0].z + 0.5 } : this.position);
    }
  }
  throwSwitch(id: string) {
    if (this.switches.has(id)) return false;
    this.switches.add(id);
    this.sfx("select");
    const doors = this.def.doors.filter((d) => d.switchId === id);
    for (const d of doors) this.openDoor(d);
    this.say(doors.length ? "Clunk! A door slid open." : "Clunk!");
    return true;
  }
  private checkDoors() {
    for (const d of this.def.doors) {
      if (this.doorsOpen.has(d.id)) continue;
      if (d.boss && this.bossHP === 0) this.openDoor(d);
      else if (d.needsKeys && this.keys.length >= d.needsKeys && d.cells.some((c) => dist3(this.position, { x: c.x + 0.5, y: c.y, z: c.z + 0.5 }) < 3.5)) {
        this.openDoor(d);
        this.say("All the keys turn at once. The vault is open!");
      }
    }
  }
  /* ── actions ─────────────────────────────────────────────────────────── */
  cyclePower() {
    const available = ACTIVE_POWERS.filter((p) => this.has(p));
    if (!available.length) {
      this.say("Rescue your friends to fill the Power Wheel!");
      return;
    }
    this.active = available[(available.indexOf(this.active!) + 1) % available.length];
    this.say(`${FRIENDS.find((f) => f.power === this.active)!.powerName} · C to use`);
    this.sfx("select");
  }
  usePower() {
    if (!this.active) {
      this.say("Bash a rescue cage to earn a friend's power.");
      return;
    }
    if (this.powerCooldown > 0) return;
    if (this.saveData.sparks <= 0) {
      this.say("Out of sparks! Coins and checkpoints refill them.");
      this.sfx("pop");
      return;
    }
    if (this.active === "rocket" && (!this.grounded || this.rocketCooldown > 0)) {
      if (!this.grounded) this.say("Rocket needs solid ground under you.");
      return;
    }
    this.saveData.sparks--;
    this.powerCooldown = 5;
    this.powerTime = 3;
    this.sfx("powerup");
    if (this.active === "rocket") {
      this.velocity.y = PHYS.rocket;
      this.grounded = false;
      this.rocketCooldown = PHYS.rocketCooldown;
      this.sfx("boost");
    }
    if (this.active === "pound") {
      this.velocity.y = -23;
      this.bash(4, 3);
      this.sfx("stomp");
    }
    if (this.active === "megaPunch") this.bash(5, 3);
    if (this.active === "freeze") this.sfx("freeze");
    if (this.active === "bubble") {
      this.velocity.y = Math.max(this.velocity.y, 6);
      this.grounded = false;
      this.sfx("pop");
    }
    this.say(`${FRIENDS.find((f) => f.power === this.active)!.powerName}!`);
  }
  /** Cubo slides under you and grows into a four-block pillar. Grounded only. */
  liftUp() {
    if (!this.hasCubo) {
      this.say("You'll meet Cubo in Star World!");
      return false;
    }
    if (this.liftCooldown > 0 || this.lift !== "idle" || !this.grounded) return false;
    const top = this.position.y + CUBO_SIZE;
    if (!volumeFree(this.grid, [], this.position.x, top, this.position.z, this.half, this.height, this.half)) {
      this.say("Cubo: Not enough headroom here!");
      return false;
    }
    this.cubo.x = this.position.x;
    this.cubo.z = this.position.z;
    this.cubo.y = this.position.y;
    this.cubo.h = CUBO_SIZE;
    this.position.y = top;
    this.velocity.y = 0;
    this.groundBody = this.cubo;
    this.lift = "grow";
    this.liftTime = 0;
    this.liftCooldown = PHYS.liftCooldown;
    this.sfx("boost");
    this.say("Cubo: Hop on! Going up!");
    return true;
  }
  interact() {
    if (this.portalOpen && dist3(this.position, this.def.portal) < 2.5) return this.nextWorld();
    const sw = this.entities("switch").find((s) => !this.switches.has(s.id) && dist2(s.at, this.position) < 2 && Math.abs(s.at.y - this.position.y) < 2);
    if (sw) {
      this.effect("switch", sw.at);
      return this.throwSwitch(sw.id);
    }
    if (this.hasCubo && dist3(this.position, this.cubo) < 4) return this.liftUp();
    return false;
  }
  /** Melee: cages, switches and (later) enemies within reach in front of the hero, or under the reticle. */
  bash(radius = 2.6, hits = 1) {
    if (this.attackCooldown > 0) return;
    this.attack = 0.42;
    this.attackCooldown = 0.42;
    this.sfx("bash");
    this.effect("bash");
    const fx = Math.sin(this.yaw),
      fz = Math.cos(this.yaw);
    const inFront = (p: Vec3) => {
      const dx = p.x - this.position.x,
        dz = p.z - this.position.z;
      const d = Math.hypot(dx, dz);
      return d < radius && Math.abs(p.y - this.position.y) < 2.5 && (d < 1.2 || (dx * fx + dz * fz) / d > -0.2 || this.aim.id !== null);
    };
    for (const c of this.cages) {
      if (this.saveData.rescued.includes(c.friend) || !(inFront(c.at) || (this.aim.kind === "cage" && this.aim.id === c.friend && this.aim.dist < radius + 1))) continue;
      c.hp -= hits;
      this.sfx("crack");
      this.effect("bash", c.at);
      if (c.hp <= 0) this.free(c);
      else this.say(`${c.hp} more to crack ${FRIEND_BY_ID[c.friend].name}'s cage!`, 2);
    }
    for (const s of this.entities("switch")) if (!this.switches.has(s.id) && inFront(s.at)) this.throwSwitch(s.id);
  }
  free(c: CageState) {
    if (this.saveData.rescued.includes(c.friend)) return;
    this.saveData.rescued.push(c.friend);
    const f = FRIEND_BY_ID[c.friend];
    if (!f.passive) this.active = f.power;
    this.sfx("powerup");
    this.effect("rescue", c.at);
    this.rescue = c.friend;
    this.paused = true;
    this.hearts = this.maxHearts;
    this.save();
  }
  nextWorld() {
    if (!this.portalOpen) return false;
    this.sfx("portal");
    if (this.def.id >= LAST_WORLD || this.def.id >= WORLDS.length) {
      this.saveData.finished = true;
      this.saveData.unlocked = LAST_WORLD;
      this.paused = true;
      this.save();
      return true;
    }
    const next = this.def.id + 1;
    this.saveData.world = next;
    this.saveData.unlocked = Math.max(this.saveData.unlocked, next);
    this.saveData.keys = [];
    this.saveData.checkpoint = 0;
    this.loadWorld();
    return true;
  }
  loadWorld() {
    this.def = worldFor(this.saveData.world);
    this.grid = new VoxelGrid(this.def.grid.w, this.def.grid.h, this.def.grid.d);
    this.grid.data.set(this.def.grid.data);
    this.keys = [];
    this.collected.clear();
    this.switches.clear();
    this.doorsOpen.clear();
    this.crumbling.clear();
    this.regrowing.clear();
    this.cages = this.entities("cage").map((c) => ({ friend: c.friend, at: c.at, hp: this.cageMax, max: this.cageMax, armor: c.armor }));
    this.checkpointIndex = 0;
    this.checkpoint = { ...this.def.start };
    this.position = { ...this.checkpoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.hearts = this.maxHearts;
    this.invulnerable = 1.5;
    this.cuboJoined = this.cuboJoined || this.saveData.world >= 2;
    this.placeCubo();
    this.resetBoss();
    for (const d of this.def.doors) if (d.boss && this.bossHP === 0) this.openDoor(d, true);
    this.worldVersion++;
    this.say(this.def.intro, 7);
    this.save();
  }
  /* ── aiming ──────────────────────────────────────────────────────────── */
  computeAim(origin: Vec3, dir: Vec3) {
    const block = this.grid.raycast(origin, dir, 40);
    let best: AimHit = block
      ? { point: block.point, dist: block.dist, kind: "block", id: null }
      : { point: { x: origin.x + dir.x * 40, y: origin.y + dir.y * 40, z: origin.z + dir.z * 40 }, dist: 40, kind: "none", id: null };
    const test = (kind: AimHit["kind"], id: string, at: Vec3, hw: number, h: number) => {
      const d = rayBox(origin, dir, at.x - hw, at.y, at.z - hw, at.x + hw, at.y + h, at.z + hw);
      if (d !== null && d < best.dist) best = { point: { x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d }, dist: d, kind, id };
    };
    for (const c of this.cages) if (!this.saveData.rescued.includes(c.friend)) test("cage", c.friend, c.at, 0.7, 1.4);
    for (const s of this.entities("switch")) if (!this.switches.has(s.id)) test("switch", s.id, s.at, 0.5, 1);
    if (this.hasCubo) test("cubo", "cubo", this.cubo, this.cubo.hw, this.cubo.h);
    this.aim = best;
  }
  /* ── main step ───────────────────────────────────────────────────────── */
  tick(dt: number, c: Controls) {
    if (this.paused) return;
    dt = Math.min(dt, 0.04);
    this.time += dt;
    const slow = this.powerTime > 0 && this.active === "slowTime" ? 0.35 : 1;
    this.worldTime += dt * slow;
    for (const key of ["invulnerable", "attack", "attackCooldown", "powerTime", "powerCooldown", "rocketCooldown", "messageTime", "liftCooldown", "ceilingToast"] as const)
      this[key] = Math.max(0, this[key] - dt);
    this.effects = this.effects.filter((e) => (e.age += dt) < 1.3);
    this.tickBlocks(dt);
    if (c.aimOrigin && c.aimDir) this.computeAim(c.aimOrigin, c.aimDir);
    if (c.cycle) this.cyclePower();
    if (c.power) this.usePower();
    if (c.lift) this.liftUp();
    if (c.bash) this.bash();
    if (c.interact) this.interact();
    if (this.paused) return;
    this.tickCubo(dt);
    // Ride whatever we stood on last frame (Cubo, his pillar, movers).
    if (this.groundBody) {
      this.position.x += this.groundBody.dx;
      this.position.z += this.groundBody.dz;
      if (this.groundBody.dy > 0) this.position.y = Math.max(this.position.y, this.groundBody.y + this.groundBody.h);
    }
    const len = Math.hypot(c.x, c.z);
    const nx = c.x / Math.max(1, len),
      nz = c.z / Math.max(1, len);
    const running = this.powerTime > 0 && (this.active === "speed" || this.active === "dash");
    const speed = PHYS.run * (running ? 1.65 : 1);
    if (this.grounded && this.groundBlock === B.ice) {
      const k = 1 - Math.exp(-dt * 2.5);
      this.velocity.x += (nx * speed - this.velocity.x) * k;
      this.velocity.z += (nz * speed - this.velocity.z) * k;
    } else {
      this.velocity.x = nx * speed;
      this.velocity.z = nz * speed;
    }
    const belt = this.grounded ? CONVEYOR[this.groundBlock] : null;
    if (belt) {
      this.velocity.x += belt.x * 3;
      this.velocity.z += belt.z * 3;
    }
    if (len > 0.1) this.yaw = Math.atan2(nx, nz);
    this.coyote = this.grounded ? PHYS.coyote : Math.max(0, this.coyote - dt);
    this.jumpBuffer = c.jump ? PHYS.buffer : Math.max(0, this.jumpBuffer - dt);
    const inWater = this.touching.has(B.water);
    // Stationary hold-and-release Ultra Jump.
    if (c.jump && c.heldJump && this.grounded && len < 0.1 && !inWater) {
      this.charging = true;
      this.jumpCharge = 0;
      this.jumpBuffer = 0;
    }
    if (this.charging) {
      if (c.heldJump && this.grounded && len < 0.1) {
        this.jumpCharge += dt;
        this.jumpBuffer = 0;
        if (this.jumpCharge >= PHYS.ultraHold && this.jumpCharge - dt < PHYS.ultraHold) {
          this.sfx("ultraCharge");
          this.say("Ultra Jump charged! Release to soar.", 2);
        }
      } else {
        if (this.grounded) {
          const ultra = this.jumpCharge >= PHYS.ultraHold;
          this.velocity.y = ultra ? PHYS.ultra : PHYS.jump;
          this.jumps = 1;
          this.grounded = false;
          this.groundBody = null;
          this.coyote = 0;
          this.jumpBuffer = 0;
          this.sfx(ultra ? "ultra" : "jump");
          this.effect("jump");
        }
        this.charging = false;
        this.jumpCharge = 0;
      }
    }
    if (inWater) {
      this.velocity.y = Math.max(this.velocity.y, PHYS.swimFall);
      if (c.jump) {
        this.velocity.y = PHYS.swimUp;
        this.sfx("splash");
      }
      this.jumps = 0;
      this.jumpBuffer = 0;
    } else if (this.jumpBuffer > 0 && (this.coyote > 0 || (this.has("doubleJump") && this.jumps < 2))) {
      const second = this.coyote <= 0;
      this.velocity.y = second ? PHYS.doubleJump : PHYS.jump;
      this.jumps++;
      this.grounded = false;
      this.groundBody = null;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.sfx("jump");
      this.effect("jump");
    }
    this.velocity.y = Math.max(PHYS.terminal, this.velocity.y - PHYS.gravity * dt);
    if (this.has("glide") && c.heldJump && this.velocity.y < 0 && !this.grounded && this.stamina > 0) {
      this.velocity.y = Math.max(PHYS.glideFall, this.velocity.y);
      this.stamina = Math.max(0, this.stamina - dt);
    }
    if (this.grounded) this.stamina = Math.min(PHYS.glideStamina, this.stamina + dt * 1.5);
    if (this.powerTime > 0 && this.active === "bubble") this.velocity.y = Math.max(-1.5, this.velocity.y);
    const wasGrounded = this.grounded;
    const r = sweep(this.grid, this.bodies, this.position, this.half, this.height, { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt });
    this.grounded = r.grounded;
    this.groundBlock = r.groundBlock;
    this.groundBody = r.groundBody;
    this.touching = r.touching;
    if (r.grounded) {
      if (this.velocity.y < -0.5) this.velocity.y = 0;
      this.jumps = 0;
      if (r.groundBlock === B.bounce) {
        this.bounceLevel = c.heldJump ? Math.min(this.bounceLevel + 1, 4) : 0;
        this.velocity.y = Math.min(PHYS.bounceMax, PHYS.bounce + this.bounceLevel * PHYS.bounceHeld);
        this.grounded = false;
        this.sfx("boing");
        this.effect("jump");
      } else {
        this.bounceLevel = 0;
        if (!wasGrounded) this.sfx("boing");
      }
      for (const i of r.groundCells) if (this.grid.data[i] === B.crumble && !this.crumbling.has(i)) this.crumbling.set(i, { t: 0.6, id: B.crumble });
    }
    if (r.hitHead) this.velocity.y = Math.min(0, this.velocity.y);
    if (r.hitWall && this.has("wallCling") && c.heldJump && this.velocity.y < 0) {
      this.velocity.y = -1;
      this.jumps = Math.min(this.jumps, 1);
    }
    if (r.touching.has(B.spike)) this.damage();
    if (r.touching.has(B.goo)) {
      this.damage();
      if (this.hearts > 0) this.resetCheckpoint();
    }
    // World bounds, sky ceiling, kill plane.
    const limit = this.def.ceiling - this.height;
    if (this.position.y > limit) {
      this.position.y = limit;
      this.velocity.y = Math.min(0, this.velocity.y);
      if (this.ceilingToast === 0) {
        this.ceilingToast = 4;
        this.say("Too high! Cubo can't follow up here.", 2);
      }
    }
    this.position.x = clamp(this.position.x, 0.5, this.grid.w - 0.5);
    this.position.z = clamp(this.position.z, 0.5, this.grid.d - 0.5);
    if (this.position.y < -8) {
      this.resetCheckpoint();
      return;
    }
    if (this.grounded && len > 0.3 && (this.footstep += dt) > 0.33) {
      this.footstep = 0;
      this.sfx("step");
    }
    this.tickPickups();
    this.checkDoors();
    this.hint = "";
    for (const s of this.entities("sign")) if (dist2(s.at, this.position) < 2.6 && Math.abs(s.at.y - this.position.y) < 2) this.hint = s.text;
    if ((this.saveTimer += dt) > 5) {
      this.saveTimer = 0;
      this.save();
    }
  }
  private tickBlocks(dt: number) {
    for (const [i, t] of this.crumbling) {
      t.t -= dt;
      if (t.t <= 0) {
        this.crumbling.delete(i);
        this.grid.data[i] = B.air;
        this.grid.dirty.add(cellChunk(this.grid, i));
        this.grid.version++;
        this.regrowing.set(i, { t: 6, id: t.id });
        this.sfx("crack");
      }
    }
    for (const [i, t] of this.regrowing) {
      t.t -= dt;
      if (t.t > 0) continue;
      const x = i % this.grid.w,
        z = Math.floor(i / this.grid.w) % this.grid.d,
        y = Math.floor(i / (this.grid.w * this.grid.d));
      if (!volumeFree(this.grid, [], this.position.x, this.position.y, this.position.z, this.half, this.height, this.half) || dist3(this.position, { x: x + 0.5, y, z: z + 0.5 }) < 1.6) {
        t.t = 0.5;
        continue;
      }
      this.regrowing.delete(i);
      this.grid.set(x, y, z, t.id as typeof B.crumble);
    }
  }
  private tickCubo(dt: number) {
    const cb = this.cubo;
    const ox = cb.x,
      oy = cb.y,
      oz = cb.z;
    if (!this.hasCubo) return;
    if (this.lift !== "idle") {
      this.liftTime += dt;
      const oldH = cb.h;
      if (this.lift === "grow") {
        cb.h = CUBO_SIZE + PHYS.liftHeight * Math.min(1, this.liftTime / PHYS.liftGrow);
        if (this.liftTime >= PHYS.liftGrow) {
          this.lift = "hold";
          this.liftTime = 0;
        }
      } else if (this.lift === "hold") {
        if (this.liftTime >= PHYS.liftHold) {
          this.lift = "shrink";
          this.liftTime = 0;
        }
      } else {
        cb.h = CUBO_SIZE + PHYS.liftHeight * Math.max(0, 1 - this.liftTime / 0.4);
        if (this.liftTime >= 0.4) {
          cb.h = CUBO_SIZE;
          this.lift = "idle";
        }
      }
      cb.dx = 0;
      cb.dz = 0;
      cb.dy = Math.max(0, cb.h - oldH); // growth lifts whoever is riding
      return;
    }
    // Hold still while the hero rides or is about to land on him.
    const above =
      Math.abs(this.position.x - cb.x) < cb.hw + this.half && Math.abs(this.position.z - cb.z) < cb.hd + this.half && this.position.y >= cb.y + cb.h - 0.6 && this.position.y < cb.y + cb.h + 4;
    const riding = this.groundBody === cb || above;
    if (riding) {
      cb.dx = cb.dy = cb.dz = 0;
      return;
    }
    const fx = Math.sin(this.yaw),
      fz = Math.cos(this.yaw);
    const tx = this.position.x - fx * 1.8 + fz * 0.9,
      tz = this.position.z - fz * 1.8 - fx * 0.9;
    const d = Math.hypot(tx - cb.x, tz - cb.z);
    const step = Math.min(d, (d > 8 ? 30 : 9) * dt);
    if (d > 0.05) {
      cb.x += ((tx - cb.x) / d) * step;
      cb.z += ((tz - cb.z) / d) * step;
    }
    const top = this.grid.columnTop(cb.x, cb.z) + 1;
    const ty = Math.abs(top - this.position.y) < 3 ? top : this.position.y;
    cb.y += (ty - cb.y) * (1 - Math.exp(-dt * 8));
    cb.dx = cb.x - ox;
    cb.dy = cb.y - oy;
    cb.dz = cb.z - oz;
  }
  private tickPickups() {
    const p = this.position;
    for (const e of this.def.entities) {
      if (e.kind === "coin") {
        if (this.collected.has(e.id)) continue;
        const r = this.has("magnet") ? 4.7 : 1.2;
        if (dist2(e.at, p) < r && Math.abs(e.at.y - p.y) < 2.2) {
          this.collected.add(e.id);
          this.saveData.coins++;
          if (this.saveData.coins % 15 === 0 && this.saveData.sparks < 3) {
            this.saveData.sparks++;
            this.say("+1 spark!", 1.5);
          }
          this.effect("coin", e.at);
          this.sfx("coin");
        }
      } else if (e.kind === "key") {
        if (this.collected.has(e.id) || dist3(e.at, p) > 1.4) continue;
        this.collected.add(e.id);
        this.keys.push(e.id);
        this.effect("key", e.at);
        this.sfx("powerup");
        this.say(`Key ${this.keys.length} of ${this.keysNeeded}!`);
        this.save();
      } else if (e.kind === "star") {
        if (this.saveData.stars.includes(e.id) || dist3(e.at, p) > 1.4) continue;
        this.saveData.stars.push(e.id);
        this.effect("rescue", e.at);
        this.sfx("coin");
        this.say("A secret star!");
        this.save();
      } else if (e.kind === "checkpoint") {
        if (e.index <= this.checkpointIndex || dist2(e.at, p) > 1.6 || Math.abs(e.at.y - p.y) > 1.5) continue;
        this.checkpointIndex = e.index;
        this.checkpoint = { ...e.at };
        this.hearts = this.maxHearts;
        this.saveData.sparks = 3;
        this.sfx("powerup");
        this.effect("rescue", e.at);
        this.say("Checkpoint! Hearts and sparks refilled.");
        this.save();
      }
    }
  }
  objective() {
    if (this.saveData.finished) return "Everybody is home!";
    const cage = this.cages.find((c) => !this.saveData.rescued.includes(c.friend));
    if (this.keys.length < this.keysNeeded) return `Find the keys · ${this.keys.length}/${this.keysNeeded}${cage ? ` · free ${FRIEND_BY_ID[cage.friend].name}` : ""}`;
    if (cage) return `Free ${FRIEND_BY_ID[cage.friend].name} from the cage`;
    if (this.bossHP > 0) return `Defeat ${this.bossName}`;
    return "The portal is open — E to hop through!";
  }
  snapshot(): Snapshot {
    return {
      hero: this.saveData.hero,
      world: this.def.id,
      worldName: this.def.name,
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      coins: this.saveData.coins,
      keys: this.keys.length,
      keysNeeded: this.keysNeeded,
      stars: this.saveData.stars.length,
      rescued: [...this.saveData.rescued],
      active: this.active,
      powerCooldown: Math.ceil(this.powerCooldown),
      sparks: this.saveData.sparks,
      stamina: this.stamina / PHYS.glideStamina,
      message: this.messageTime > 0 ? this.message : this.hint,
      objective: this.objective(),
      rescue: this.rescue,
      portalOpen: this.portalOpen,
      finished: this.saveData.finished,
      saveFailed: this.saveFailed,
      bossHP: this.bossHP,
      bossMax: this.bossMax,
      bossName: this.bossName,
      aim: this.aim.kind,
      hasCubo: this.hasCubo,
      liftCooldown: Math.ceil(this.liftCooldown),
      checkpointIndex: this.checkpointIndex,
    };
  }
}

const CONVEYOR: Record<number, Vec3 | undefined> = {
  [B.conveyorN]: { x: 0, y: 0, z: -1 },
  [B.conveyorS]: { x: 0, y: 0, z: 1 },
  [B.conveyorE]: { x: 1, y: 0, z: 0 },
  [B.conveyorW]: { x: -1, y: 0, z: 0 },
};
const cellChunk = (g: VoxelGrid, i: number) => `${Math.floor((i % g.w) / 16)},${Math.floor((Math.floor(i / g.w) % g.d) / 16)}`;

/** Slab ray/AABB intersection; returns the entry distance or null. */
export function rayBox(o: Vec3, d: Vec3, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  let tmin = 0,
    tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [o.x, d.x, x0, x1],
    [o.y, d.y, y0, y1],
    [o.z, d.z, z0, z1],
  ];
  for (const [p, v, a, b] of axes) {
    if (Math.abs(v) < 1e-9) {
      if (p < a || p > b) return null;
      continue;
    }
    let t0 = (a - p) / v,
      t1 = (b - p) / v;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return null;
  }
  return tmin;
}
