/**
 * Every moving/interactive thing in a level. Actors collide with tiles and
 * ride platforms; they never collide with each other, so Cubo can never
 * block the hero. Drawing lives in render.ts — entities are pure state.
 */
import {
  PHYS,
  T,
  TILE,
  centerX,
  centerY,
  clamp,
  dist,
  overlaps,
  type Body,
  type EntityLike,
  type FriendId,
  type GameCtx,
  type HeroKind,
  type Platform,
  type PowerId,
} from "./types";
import { FRIEND_BY_ID } from "../worlds/friends";

export interface HeroControls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  jumpReleased: boolean;
  bashPressed: boolean;
  powerPressed: boolean;
  downPressed: boolean;
  upPressed: boolean;
}
export const emptyHeroControls = (): HeroControls => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,
  jumpReleased: false,
  bashPressed: false,
  powerPressed: false,
  downPressed: false,
  upPressed: false,
});

export interface CuboControls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
  action: boolean;
  actionPressed: boolean;
}
export const emptyCuboControls = (): CuboControls => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jumpPressed: false,
  action: false,
  actionPressed: false,
});

let nextId = 1;

/* ═══════════════════════════════════════════════════════════════════════ */
export abstract class Actor implements EntityLike {
  id = nextId++;
  layer = 1;
  dead = false;
  abstract kind: string;
  body: Body;
  vx = 0;
  vy = 0;
  facing = 1;
  onGround = false;
  wasGround = false;
  onOneway = false;
  inWater = false;
  waterDepth = 0;
  riding: Platform | null = null;
  buoyant = false;
  gravityScale = 1;
  dropThrough = false;
  /** ignores tiles entirely (cutscenes / floating) */
  noClip = false;
  hitWall = false;
  hitHead = false;
  onBounce = false;
  onGoo = false;
  landedThisStep = false;
  landVy = 0;
  anim = 0;

  constructor(x: number, y: number, w: number, h: number) {
    this.body = { x, y, w, h };
  }

  abstract update(g: GameCtx, dt: number): void;

  /** Gravity + tile sweep + platform ride. */
  physics(g: GameCtx, dt: number, opts: { maxFall?: number; gravity?: number } = {}): void {
    const b = this.body;
    const map = g.map;
    this.wasGround = this.onGround;
    this.landedThisStep = false;
    this.hitWall = false;
    this.hitHead = false;

    if (this.noClip) {
      b.x += this.vx * dt;
      b.y += this.vy * dt;
      this.onGround = false;
      return;
    }

    this.waterDepth = map.waterDepth(b);
    this.inWater = this.waterDepth > 0.35;

    // carried by platform
    if (this.riding) {
      const p = this.riding;
      const stillOn = b.x + b.w > p.x - 2 && b.x < p.x + p.w + 2;
      if (stillOn && this.vy >= 0) {
        b.x += p.vx * dt;
        b.y = p.y - b.h;
      } else this.riding = null;
    }

    // gravity
    if (this.inWater) {
      if (this.buoyant) {
        // float at the surface
        const surfaceY = this.findSurface(g);
        const target = surfaceY - b.h * 0.55;
        this.vy += (target - b.y) * 12 * dt;
        this.vy *= 0.9;
      } else {
        this.vy += (opts.gravity ?? PHYS.waterGravity) * dt;
        this.vy *= Math.pow(PHYS.waterDrag, dt * 60);
        this.vy = clamp(this.vy, -260, 200);
      }
    } else {
      this.vy += (opts.gravity ?? PHYS.gravity) * this.gravityScale * dt;
      const mf = opts.maxFall ?? PHYS.maxFall;
      if (this.vy > mf) this.vy = mf;
    }

    // X sweep
    const prevBottom = b.y + b.h;
    if (map.moveX(b, this.vx * dt)) {
      this.hitWall = true;
      this.vx = 0;
    }
    // Y sweep
    const r = map.moveY(b, this.vy * dt, this.dropThrough);
    this.onGround = false;
    this.onOneway = false;
    if (r.onGround) {
      this.onGround = true;
      this.onOneway = r.onOneway;
      if (this.vy > 0) this.landVy = this.vy;
      this.vy = 0;
    }
    if (r.hitHead) {
      this.hitHead = true;
      this.vy = 0;
    }

    // platforms (one-way from above)
    if (this.vy >= 0 && !this.dropThrough) {
      let best: Platform | null = null;
      for (const p of g.platforms) {
        if (p.owner === this) continue;
        if (b.x + b.w <= p.x || b.x >= p.x + p.w) continue;
        const bottom = b.y + b.h;
        if (bottom >= p.y && prevBottom <= p.y + Math.max(6, p.vy * -dt + 6) && bottom <= p.y + p.h + 8) {
          if (!best || p.y < best.y) best = p;
        }
      }
      if (best) {
        b.y = best.y - b.h;
        if (this.vy > 0) this.landVy = this.vy;
        this.vy = 0; // riders are carried by position (see top of physics), never by velocity
        this.onGround = true;
        this.riding = best;
      } else if (this.riding) {
        // still standing on a moving platform?
        const p = this.riding;
        const on = b.x + b.w > p.x && b.x < p.x + p.w && Math.abs(b.y + b.h - p.y) < 10;
        if (on) {
          b.y = p.y - b.h;
          this.onGround = true;
        } else this.riding = null;
      }
    } else this.riding = null;

    if (this.onGround && !this.wasGround) this.landedThisStep = true;

    // sensors
    const under = map.under(b);
    this.onBounce = this.onGround && under.includes(T.BOUNCE);
    this.onGoo = this.onGround && under.includes(T.GOO);
    if (this.onGround) this.dropThrough = false;

    // world edges
    if (b.x < 0) {
      b.x = 0;
      this.vx = Math.max(0, this.vx);
    }
    if (b.x + b.w > map.pixelW) {
      b.x = map.pixelW - b.w;
      this.vx = Math.min(0, this.vx);
    }
  }

  private findSurface(g: GameCtx): number {
    const b = this.body;
    const cx = b.x + b.w / 2;
    let ty = Math.floor((b.y + b.h / 2) / TILE);
    while (ty > 0 && g.map.get(Math.floor(cx / TILE), ty - 1) === T.WATER) ty--;
    return ty * TILE;
  }

  get cx(): number {
    return centerX(this.body);
  }
  get cy(): number {
    return centerY(this.body);
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
export interface PowerEffects {
  bubble: number;
  shrink: number;
  rocket: number;
  dash: number;
  speed: number;
  slow: number;
  megaPunch: boolean;
  shieldReady: boolean;
  shieldRecharge: number;
}

const ACTIVE_ORDER: PowerId[] = ["pound", "bubble", "shrink", "rocket", "dash", "freeze", "slowTime", "speed", "megaPunch"];
const COOLDOWN: Partial<Record<PowerId, number>> = {
  pound: 0.4,
  bubble: 6,
  shrink: 1,
  rocket: 2.5,
  dash: 1.2,
  freeze: 1.5,
  slowTime: 8,
  speed: 8,
  megaPunch: 3,
};

export class Hero extends Actor {
  kind = "hero";
  heroKind: HeroKind;
  ctl: HeroControls = emptyHeroControls();
  hearts = 3;
  maxHearts = 3;
  coyote = 0;
  jumpBuffer = 0;
  jumping = false;
  jumpT = 0;
  ultraCharge = 0;
  ultraReady = false;
  ultraFired = 0;
  doubleJumpUsed = false;
  wallSlide = 0; // -1 left wall, 1 right wall, 0 none
  pounding = false;
  gliding = false;
  swimTimer = 0;
  hurtTimer = 0;
  invuln = 0;
  held = 0; // being lifted by Cubo
  frozenControls = 0;
  /** hero is inside a candy cage (game owns the cage entity) */
  caged = false;
  bashAnim = 0;
  bashTime = -1;
  lastBashHit = false;
  upHeld = 0;
  powers = new Set<PowerId>();
  activeSlots: PowerId[] = [];
  selected = 0;
  cooldowns: Partial<Record<PowerId, number>> = {};
  fx: PowerEffects = { bubble: 0, shrink: 0, rocket: 0, dash: 0, speed: 0, slow: 0, megaPunch: false, shieldReady: true, shieldRecharge: 0 };
  baseH = 34;
  respawnTimer = 0;
  dead2 = false; // fell out / zero hearts → waiting for respawn
  lastSafe = { x: 0, y: 0 };
  squash = 1;
  stretch = 1;

  constructor(x: number, y: number, kind: HeroKind) {
    super(x, y, 22, 34);
    this.heroKind = kind;
  }

  grantPower(p: PowerId): void {
    this.powers.add(p);
    this.activeSlots = ACTIVE_ORDER.filter((a) => this.powers.has(a));
  }
  has(p: PowerId): boolean {
    return this.powers.has(p);
  }
  get selectedPower(): PowerId | null {
    return this.activeSlots[this.selected] ?? null;
  }
  cycle(dir: number): void {
    if (!this.activeSlots.length) return;
    this.selected = (this.selected + dir + this.activeSlots.length) % this.activeSlots.length;
  }
  selectSlot(i: number): void {
    if (i < this.activeSlots.length) this.selected = i;
  }

  hurt(g: GameCtx, fromX: number, amount = 1): boolean {
    if (this.invuln > 0 || this.dead2 || g.god) return false;
    if (this.fx.bubble > 0 || this.fx.dash > 0) return false;
    if (this.has("shield") && this.fx.shieldReady) {
      this.fx.shieldReady = false;
      this.fx.shieldRecharge = 8;
      this.invuln = 0.8;
      g.sfx("pop");
      g.particles.burst(this.cx, this.cy, 14, "#4ade80", { shape: "ring", speed: 200 });
      return false;
    }
    this.hearts -= amount;
    this.hurtTimer = 0.4;
    this.invuln = 1.3;
    this.vy = -330;
    this.vx = this.cx < fromX ? -220 : 220;
    this.frozenControls = 0.25;
    this.held = 0;
    this.pounding = false;
    g.sfx("hit");
    g.shake(0.45);
    g.particles.burst(this.cx, this.cy, 10, "#f87171");
    if (this.hearts <= 0) this.die(g);
    return true;
  }

  die(g: GameCtx): void {
    if (this.dead2 || g.god) return;
    this.dead2 = true;
    this.respawnTimer = 0.9;
    this.hurtTimer = 1;
    this.vy = -420;
    this.vx = 0;
    this.noClip = true;
    g.sfx("hit");
    g.shake(0.6);
  }

  respawnAt(x: number, y: number): void {
    this.body.x = x;
    this.body.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hearts = this.maxHearts;
    this.dead2 = false;
    this.noClip = false;
    this.invuln = 1.5;
    this.hurtTimer = 0;
    this.held = 0;
    this.caged = false;
    this.pounding = false;
    this.fx.bubble = 0;
    this.fx.dash = 0;
    this.fx.rocket = 0;
    this.fx.shrink = 0;
    this.body.h = this.baseH;
    this.riding = null;
  }

  private tick(dt: number): void {
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.frozenControls = Math.max(0, this.frozenControls - dt);
    this.bashAnim = Math.max(0, this.bashAnim - dt);
    this.ultraFired = Math.max(0, this.ultraFired - dt);
    for (const k of Object.keys(this.cooldowns) as PowerId[]) {
      const v = this.cooldowns[k];
      if (v !== undefined) this.cooldowns[k] = Math.max(0, v - dt);
    }
    const f = this.fx;
    f.bubble = Math.max(0, f.bubble - dt);
    f.rocket = Math.max(0, f.rocket - dt);
    f.dash = Math.max(0, f.dash - dt);
    f.speed = Math.max(0, f.speed - dt);
    if (!f.shieldReady) {
      f.shieldRecharge -= dt;
      if (f.shieldRecharge <= 0) f.shieldReady = true;
    }
    this.squash += (1 - this.squash) * Math.min(1, dt * 14);
    this.stretch += (1 - this.stretch) * Math.min(1, dt * 14);
  }

  update(g: GameCtx, dt: number): void {
    this.tick(dt);
    const c = this.ctl;
    const b = this.body;

    if (this.dead2) {
      this.vy += PHYS.gravity * dt;
      b.y += this.vy * dt;
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) g.heroRespawned();
      return;
    }

    if (this.caged || this.held > 0) {
      if (this.held > 0) {
        this.held -= dt;
        this.vx = 0;
        this.vy = 0;
        if (this.held <= 0) {
          this.vy = PHYS.boostV;
          this.jumping = true;
          this.doubleJumpUsed = false;
          g.sfx("boost");
          g.particles.burst(this.cx, b.y + b.h, 16, ["#fde047", "#60a5fa"], { speed: 260 });
        }
      }
      this.anim += dt;
      return;
    }

    // shrink expiry (blocked under a ceiling)
    if (this.fx.shrink > 0) {
      this.fx.shrink -= dt;
      if (this.fx.shrink <= 0) {
        const probe: Body = { x: b.x, y: b.y + b.h - this.baseH, w: b.w, h: this.baseH };
        if (g.map.overlapsSolid(probe)) this.fx.shrink = 0.2;
        else {
          b.y = b.y + b.h - this.baseH;
          b.h = this.baseH;
          g.sfx("pop");
        }
      }
    }

    const frozen = this.frozenControls > 0;
    this.upHeld = c.up && this.onGround ? this.upHeld + dt : 0;
    const left = !frozen && c.left;
    const right = !frozen && c.right;
    const speedMul = this.fx.speed > 0 ? 1.7 : 1;
    const gooMul = this.onGoo ? PHYS.gooFactor : 1;
    const runMax = PHYS.runMax * speedMul * gooMul;

    /* ── horizontal ── */
    if (this.fx.dash > 0) {
      this.vx = this.facing * 640;
    } else {
      const want = (left ? -1 : 0) + (right ? 1 : 0);
      const accel = (this.onGround ? PHYS.accel : PHYS.accel * PHYS.airControl) * (this.inWater ? 0.6 : 1);
      if (want !== 0) {
        this.vx += want * accel * dt;
        this.facing = want;
        if (Math.abs(this.vx) > runMax) this.vx -= (this.vx - Math.sign(this.vx) * runMax) * Math.min(1, dt * 8);
      } else {
        const fr = (this.onGround ? PHYS.friction : PHYS.friction * 0.25) * dt;
        if (Math.abs(this.vx) <= fr) this.vx = 0;
        else this.vx -= Math.sign(this.vx) * fr;
      }
    }

    /* ── jumping ── */
    if (this.onGround) {
      this.coyote = PHYS.coyote;
      this.doubleJumpUsed = false;
      this.jumping = false;
      this.wallSlide = 0;
      this.gliding = false;
      if (this.pounding) {
        this.pounding = false;
        this.pound(g);
      }
    } else this.coyote = Math.max(0, this.coyote - dt);
    if (c.jumpPressed && !frozen) this.jumpBuffer = PHYS.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // ultra jump: hold jump ≥0.5 s while grounded & still
    const still = this.onGround && Math.abs(this.vx) < 20 && !left && !right;
    if (c.jump && still && !this.inWater && !frozen) {
      const was = this.ultraCharge;
      this.ultraCharge = Math.min(PHYS.ultraHold, this.ultraCharge + dt);
      if (was < 0.08 && this.ultraCharge >= 0.08) g.sfx("ultraCharge");
      if (this.ultraCharge >= PHYS.ultraHold) {
        this.ultraReady = true;
        g.shake(0.08);
        if (g.rng.next() < 0.5) g.particles.trail(this.cx + g.rng.range(-10, 10), b.y + b.h, "#fde047");
      }
      this.squash = 0.8;
      this.stretch = 1.15;
    } else if (c.jumpReleased && !frozen && this.ultraCharge > 0) {
      if (this.ultraReady && this.onGround) {
        this.vy = PHYS.ultraV;
        this.ultraFired = 0.6;
        this.jumping = true;
        this.onGround = false;
        this.riding = null;
        g.sfx("ultra");
        g.shake(0.35);
        g.particles.burst(this.cx, b.y + b.h, 22, ["#fde047", "#fb923c", "#fff"], { speed: 300 });
        this.stretch = 1.5;
        this.squash = 0.7;
      }
      this.ultraCharge = 0;
      this.ultraReady = false;
      this.jumpBuffer = 0;
    } else if (!c.jump) {
      this.ultraCharge = 0;
      this.ultraReady = false;
    }

    if (this.inWater && !this.buoyant && this.onGround && this.jumpBuffer > 0) {
      // standing on something under water → hop out like a normal jump
      this.doJump(g, PHYS.jumpV * 0.8);
    } else if (this.inWater && !this.buoyant) {
      this.swimTimer = Math.max(0, this.swimTimer - dt);
      if ((c.up || c.jump) && this.swimTimer <= 0) {
        this.vy = PHYS.swimImpulse;
        this.swimTimer = PHYS.swimEvery;
        if (g.rng.next() < 0.5) g.particles.burst(this.cx, b.y, 2, "#e0f2fe", { speed: 60, gravity: -150, ttl: 0.6, size: 3 });
      }
      if (c.down) this.vy += 240 * dt;
      this.jumpBuffer = 0;
    } else if (this.jumpBuffer > 0 && !this.ultraReady && this.ultraCharge < 0.15) {
      if (this.coyote > 0 || this.onGround) {
        this.doJump(g, PHYS.jumpV);
      } else if (this.wallSlide !== 0 && this.has("wallCling")) {
        this.vy = PHYS.jumpV * 0.95;
        this.vx = -this.wallSlide * 300;
        this.facing = -this.wallSlide;
        this.wallSlide = 0;
        this.jumping = true;
        this.jumpBuffer = 0;
        g.sfx("jump");
        g.particles.burst(this.cx + this.facing * -8, this.cy, 6, "#a3e635");
      } else if (this.has("doubleJump") && !this.doubleJumpUsed && this.fx.bubble <= 0) {
        this.doubleJumpUsed = true;
        this.doJump(g, PHYS.jumpV * 0.9);
        g.particles.burst(this.cx, b.y + b.h, 10, "#34d399", { speed: 160, gravity: 200 });
      }
    }
    // variable height
    this.jumpT += dt;
    if (this.jumping && !c.jump && this.vy < 0 && this.ultraFired <= 0 && this.jumpT > 0.12) {
      this.vy *= PHYS.jumpCut;
      this.jumping = false;
    }

    /* ── powers ── */
    this.handlePowers(g, dt);

    /* ── bash ── */
    if (c.bashPressed && !frozen) this.bash(g);

    /* ── physics ── */
    const wasVy = this.vy;
    let maxFall: number | undefined;
    let gravity: number | undefined;
    if (this.fx.bubble > 0) {
      gravity = 0;
      this.vy = clamp(this.vy + (c.down ? 120 : -60) * dt, -90, 90);
      maxFall = 90;
    } else if (this.fx.rocket > 0) {
      gravity = 0;
      this.vy = -430;
    } else if (this.fx.dash > 0) {
      gravity = 0;
      this.vy = 0;
    } else if (this.has("glide") && c.jump && this.vy > 0 && !this.onGround && !this.inWater && !this.pounding) {
      maxFall = 90;
      this.gliding = true;
      if (g.rng.next() < 0.3) g.particles.trail(this.cx + g.rng.range(-8, 8), b.y, "#c4b5fd");
    } else this.gliding = false;
    if (this.pounding) {
      maxFall = 900;
      gravity = 5000;
    }
    if (this.wallSlide !== 0 && this.vy > 0) maxFall = 70;

    this.dropThrough = c.down && this.onOneway && c.downPressed ? true : this.dropThrough;
    if (c.downPressed && this.onOneway && !this.riding) {
      this.dropThrough = true;
      this.onGround = false;
      b.y += 2;
    }
    this.physics(g, dt, { maxFall, gravity });
    if (this.dropThrough && !this.onGround) {
      // keep dropping through one-ways until clear
      const probe: Body = { x: b.x, y: b.y - 4, w: b.w, h: b.h + 8 };
      let anyOneway = false;
      const x0 = Math.floor(probe.x / TILE);
      const x1 = Math.floor((probe.x + probe.w - 0.01) / TILE);
      const y0 = Math.floor(probe.y / TILE);
      const y1 = Math.floor((probe.y + probe.h) / TILE);
      for (let ty = y0; ty <= y1 && !anyOneway; ty++) for (let tx = x0; tx <= x1; tx++) if (g.map.get(tx, ty) === T.ONEWAY) anyOneway = true;
      if (!anyOneway) this.dropThrough = false;
    }

    // wall cling
    if (this.has("wallCling") && !this.onGround && !this.inWater && this.hitWall && (left || right)) {
      this.wallSlide = left ? -1 : 1;
      this.doubleJumpUsed = false;
    } else if (!this.hitWall || this.onGround) this.wallSlide = 0;

    // landing feedback
    if (this.landedThisStep) {
      this.squash = 1.25;
      this.stretch = 0.75;
      if (this.landVy > 500) g.particles.burst(this.cx, b.y + b.h, 5, "#ffffff", { speed: 90, gravity: 300, ttl: 0.3, size: 3 });
    }
    if (this.onBounce && this.landedThisStep) {
      this.vy = PHYS.bounceV * (c.jump ? 1.25 : 1);
      this.onGround = false;
      this.jumping = false;
      this.doubleJumpUsed = false;
      g.sfx("boing");
      this.stretch = 1.5;
      this.squash = 0.7;
      g.particles.burst(this.cx, b.y + b.h, 8, "#f472b6", { speed: 200 });
    }
    // water splash
    if (this.inWater && wasVy > 250 && this.vy < 200 && this.landVy === 0) {
      g.sfx("splash");
      g.particles.burst(this.cx, b.y, 10, "#bae6fd", { speed: 220, gravity: 500 });
      this.landVy = 1;
    }
    if (!this.inWater) this.landVy = 0;

    // spikes
    if (g.map.touching(b, T.SPIKE, 14) && this.fx.bubble <= 0) {
      if (this.hurt(g, this.cx + this.facing * 10)) this.vy = -430;
    }
    // fell out of the world
    if (b.y > g.map.pixelH + TILE * 2) this.die(g);

    if (this.onGround && !this.inWater && Math.abs(this.vx) > 40) this.anim += dt * (Math.abs(this.vx) / 120);
    else this.anim += dt;
    if (this.onGround && !this.inWater) this.lastSafe = { x: b.x, y: b.y };
    if (this.ultraFired > 0.3) g.particles.trail(this.cx + g.rng.range(-6, 6), b.y + b.h - 4, "#fde047");
    if (this.fx.dash > 0) g.particles.trail(this.cx - this.facing * 10, this.cy, "#fdba74");
    if (this.fx.rocket > 0) g.particles.burst(this.cx, b.y + b.h, 2, ["#fb7185", "#fde047"], { speed: 120, vy: 200, ttl: 0.3 });
    if (this.fx.speed > 0 && this.onGround && Math.abs(this.vx) > 100) g.particles.trail(this.cx - this.facing * 12, b.y + b.h - 6, "#fca5a5");
  }

  private doJump(g: GameCtx, v: number): void {
    this.vy = v;
    this.jumping = true;
    this.jumpT = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.onGround = false;
    this.riding = null;
    this.stretch = 1.3;
    this.squash = 0.8;
    g.sfx("jump");
  }

  private handlePowers(g: GameCtx, dt: number): void {
    const c = this.ctl;
    if (this.frozenControls > 0) return;
    // ground pound via DOWN in the air (Thump)
    if (this.has("pound") && c.downPressed && !this.onGround && !this.inWater && !this.pounding && this.fx.bubble <= 0) {
      this.pounding = true;
      this.vy = 200;
      this.vx = 0;
      g.sfx("stomp");
    }
    if (!c.powerPressed) return;
    const p = this.selectedPower;
    if (!p) return;
    const cd = this.cooldowns[p] ?? 0;
    if (cd > 0) return;
    const spend = () => {
      this.cooldowns[p] = COOLDOWN[p] ?? 1;
      g.sfx("powerup");
    };
    switch (p) {
      case "pound":
        if (!this.onGround && !this.pounding) {
          this.pounding = true;
          this.vy = 200;
          this.vx = 0;
          spend();
        }
        break;
      case "bubble":
        this.fx.bubble = 3;
        this.pounding = false;
        this.vy = Math.min(this.vy, 0);
        spend();
        break;
      case "shrink":
        if (this.fx.shrink <= 0) {
          this.fx.shrink = 6;
          this.body.y += this.body.h - 14;
          this.body.h = 14;
          spend();
        }
        break;
      case "rocket":
        this.fx.rocket = 0.9;
        this.pounding = false;
        this.doubleJumpUsed = false;
        spend();
        g.particles.burst(this.cx, this.body.y + this.body.h, 14, ["#fb7185", "#fde047"], { speed: 220 });
        break;
      case "dash":
        this.fx.dash = 0.22;
        this.pounding = false;
        spend();
        break;
      case "freeze":
        g.add(new Projectile(this.cx + this.facing * 14, this.cy - 4, "freeze", this.facing * 420, 0, this));
        spend();
        g.sfx("freeze");
        break;
      case "slowTime":
        this.fx.slow = 3;
        spend();
        break;
      case "speed":
        this.fx.speed = 5;
        spend();
        break;
      case "megaPunch":
        this.fx.megaPunch = true;
        this.bash(g, true);
        spend();
        break;
    }
    void dt;
  }

  private pound(g: GameCtx): void {
    const b = this.body;
    g.shake(0.5);
    g.sfx("bash");
    g.particles.burst(this.cx, b.y + b.h, 18, ["#94a3b8", "#ffffff"], { speed: 260, gravity: 500 });
    const ty = Math.floor((b.y + b.h + 2) / TILE);
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (g.map.get(tx, ty) === T.BASH) bashTile(g, tx, ty);
    for (const e of g.entities()) {
      if (e instanceof Enemy && !e.dead && Math.abs(e.cx - this.cx) < 96 && Math.abs(e.cy - this.cy) < 60) e.stun(2);
    }
  }

  /** X: bash the tile ahead, or hit anything hittable in reach. */
  bash(g: GameCtx, mega = false): void {
    const b = this.body;
    this.bashAnim = 0.18;
    const reach: Body = { x: this.facing > 0 ? b.x + b.w - 6 : b.x - 32, y: b.y - 8, w: 38, h: b.h + 16 };
    if (mega) {
      reach.x -= 16;
      reach.w += 32;
      reach.y -= 16;
      reach.h += 32;
    }
    let hitSomething = false;
    for (const e of g.entities()) {
      if (e.dead || e === this) continue;
      if (!overlaps(reach, e.body)) continue;
      if (e instanceof Hittable) {
        e.onHit(g, this.facing, mega ? 2 : 1);
        hitSomething = true;
      } else if (e instanceof Enemy) {
        e.kill(g);
        hitSomething = true;
      } else if (e instanceof Projectile && e.type === "candy") {
        e.pop(g);
        hitSomething = true;
      }
    }
    // tiles — nearest column inside the reach box that holds a bash block
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 1) / TILE);
    const cols: number[] = [];
    const c0 = Math.floor(reach.x / TILE);
    const c1 = Math.floor((reach.x + reach.w - 1) / TILE);
    for (let c = c0; c <= c1; c++) cols.push(c);
    if (this.facing < 0) cols.reverse();
    for (const tx of cols) {
      let any = false;
      for (let ty = y0; ty <= y1; ty++) {
        if (g.map.get(tx, ty) === T.BASH) {
          bashTile(g, tx, ty);
          any = true;
          if (mega) {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.map.get(tx + dx, ty + dy) === T.BASH) bashTile(g, tx + dx, ty + dy);
          }
        }
      }
      if (any) {
        hitSomething = true;
        break;
      }
    }
    if (mega) {
      g.shake(0.6);
      g.particles.burst(this.cx + this.facing * 24, this.cy, 24, ["#f97316", "#fde047", "#fff"], { speed: 320 });
      this.fx.megaPunch = false;
    }
    if (!hitSomething) g.particles.burst(this.cx + this.facing * 18, this.cy, 4, "#ffffff", { speed: 120, ttl: 0.2, size: 3, gravity: 0 });
    g.sfx(hitSomething ? "bash" : "pop");
    this.bashTime = g.time;
    this.lastBashHit = hitSomething;
  }
}

export function bashTile(g: GameCtx, tx: number, ty: number): void {
  g.map.set(tx, ty, T.AIR);
  g.map.commit(tx, ty);
  g.particles.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 12, [g.level.palette.bash, "#ffffff"], { speed: 220 });
  g.shake(0.15);
  if (g.level.flags.finale) g.add(new BlockPickup(tx * TILE + 4, ty * TILE + 4));
}

/* ═══════════════════════════════════════════════════════════════════════ */
export class Cubo extends Actor {
  kind = "cubo";
  layer = 0;
  ctl: CuboControls = emptyCuboControls();
  pillarH = 0;
  pillarGrowing = false;
  pillarPlatform: Platform;
  swing = 0;
  throwT = 0;
  holdingBlock: BlockPickup | null = null;
  blink = 0;
  poof = 0;
  hurtTimer = 0;
  stuckT = 0;
  shelled = false;
  frozenControls = 0;
  jumpingHeld = false;
  coyote = 0;
  say: string | null = null;

  constructor(x: number, y: number) {
    super(x, y, 24, 24);
    this.buoyant = true;
    this.pillarPlatform = { x, y, w: 24, h: 0, vx: 0, vy: 0, owner: this };
  }

  platform(): Platform {
    const b = this.body;
    const p = this.pillarPlatform;
    p.x = b.x;
    p.w = b.w;
    p.y = b.y - this.pillarH;
    p.h = this.pillarH + b.h;
    p.vx = this.vx;
    p.vy = this.pillarGrowing ? -TILE / 0.18 : this.vy;
    return p;
  }

  update(g: GameCtx, dt: number): void {
    this.blink -= dt;
    if (this.blink < -0.15) this.blink = 2 + g.rng.range(0, 3);
    this.poof = Math.max(0, this.poof - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.throwT = Math.max(0, this.throwT - dt);
    this.frozenControls = Math.max(0, this.frozenControls - dt);
    this.anim += dt;
    if (this.shelled) {
      this.vx = 0;
      this.physics(g, dt);
      return;
    }
    const c = this.frozenControls > 0 ? emptyCuboControls() : this.ctl;
    const want = (c.left ? -1 : 0) + (c.right ? 1 : 0);
    const max = 250 * (this.onGoo ? PHYS.gooFactor : 1);
    if (want !== 0 && this.pillarH <= 0) {
      this.vx += want * 2000 * dt;
      this.vx = clamp(this.vx, -max, max);
      this.facing = want;
    } else {
      const fr = 2400 * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * fr;
    }
    if (this.onGround) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (c.jumpPressed && (this.onGround || this.coyote > 0) && this.pillarH <= 0) {
      this.vy = -520;
      this.onGround = false;
      this.riding = null;
      g.sfx("jump");
    }
    if (this.inWater && c.up) this.vy = -140;

    // pillar: grows while `action` held on ground and standing still
    const wantPillar = c.action && this.onGround && want === 0 && !this.inWater;
    const maxPillar = TILE * 6;
    if (wantPillar) {
      const can = g.map.clearColumn(Math.floor(this.cx / TILE), Math.floor((this.body.y + this.body.h - 1) / TILE), Math.ceil((this.pillarH + TILE) / TILE));
      if (this.pillarH < maxPillar && can) {
        this.pillarGrowing = true;
        this.pillarH = Math.min(maxPillar, this.pillarH + (TILE / 0.18) * dt);
      } else this.pillarGrowing = false;
    } else {
      this.pillarGrowing = false;
      this.pillarH = Math.max(0, this.pillarH - (TILE / 0.1) * dt);
    }

    // context action (tap)
    if (c.actionPressed) this.contextAction(g);

    this.physics(g, dt, { maxFall: 600 });
    this.dropThrough = c.down && this.onOneway;
    if (this.body.y > g.map.pixelH + TILE * 3) this.teleportToHero(g, "Whoops! Shortcut!");
    if (g.map.touching(this.body, T.SPIKE, 14) && this.hurtTimer <= 0) {
      this.hurtTimer = 0.6;
      this.vy = -380;
      this.vx = -this.facing * 160;
      g.particles.burst(this.cx, this.cy, 6, "#fde047");
    }

    if (this.holdingBlock) {
      this.holdingBlock.body.x = this.cx - 12;
      this.holdingBlock.body.y = this.body.y - this.holdingBlock.body.h - 4;
    }
  }

  private contextAction(g: GameCtx): void {
    const hero = g.hero;
    // boost the hero when close
    if (dist(this.body, hero.body) < 44 && !hero.dead2 && !hero.caged && hero.held <= 0) {
      this.boostHero(g);
      return;
    }
    // bat projectile
    if (this.batNearby(g)) return;
    // throw a held block
    if (this.holdingBlock) {
      this.throwBlock(g);
      return;
    }
    // bash tile / cage ahead
    const b = this.body;
    const reach: Body = { x: this.facing > 0 ? b.x + b.w : b.x - 24, y: b.y, w: 24, h: b.h };
    for (const e of g.entities()) if (!e.dead && e instanceof Hittable && overlaps(reach, e.body)) e.onHit(g, this.facing, 1);
    const tx = Math.floor((reach.x + 12) / TILE);
    const ty = Math.floor((b.y + b.h / 2) / TILE);
    if (g.map.get(tx, ty) === T.BASH) bashTile(g, tx, ty);
    this.throwT = 0.2;
  }

  boostHero(g: GameCtx): void {
    const hero = g.hero;
    hero.held = 0.25;
    hero.body.x = this.cx - hero.body.w / 2;
    hero.body.y = this.body.y - hero.body.h;
    hero.vx = 0;
    hero.vy = 0;
    this.throwT = 0.35;
    g.particles.burst(this.cx, this.body.y, 8, "#60a5fa", { speed: 120 });
  }

  /** Swing at any boss projectile in a 48 px arc; returns true if swung. */
  batNearby(g: GameCtx): boolean {
    for (const e of g.entities()) {
      if (e instanceof Projectile && !e.dead && e.type === "hardCandy" && !e.reflected && dist(e.body, this.body) < 48) {
        e.reflect(g, this.facing);
        this.swing = 0.25;
        g.sfx("bash");
        g.shake(0.2);
        g.particles.burst(e.cx, e.cy, 10, "#ffffff", { speed: 200 });
        return true;
      }
    }
    return false;
  }

  throwBlock(g: GameCtx): void {
    const blk = this.holdingBlock;
    if (!blk) return;
    this.holdingBlock = null;
    blk.dead = true;
    g.add(new Projectile(this.cx, this.body.y - 10, "block", this.facing * 300, -600, this));
    this.throwT = 0.3;
    g.sfx("boost");
  }

  teleportToHero(g: GameCtx, line?: string): void {
    const h = g.hero;
    this.body.x = h.body.x - this.body.w - 6 * h.facing;
    this.body.y = h.body.y + h.body.h - this.body.h;
    this.vx = 0;
    this.vy = 0;
    this.pillarH = 0;
    this.riding = null;
    this.poof = 0.4;
    this.stuckT = 0;
    g.particles.burst(this.cx, this.cy, 14, ["#fde047", "#60a5fa"], { speed: 200, gravity: 0 });
    if (line) g.say("cubo", line, this.cx, this.body.y);
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
/** Anything the hero's bash (or Cubo's action) can hit. */
export abstract class Hittable extends Actor {
  hp: number;
  maxHp: number;
  flash = 0;
  constructor(x: number, y: number, w: number, h: number, hp: number) {
    super(x, y, w, h);
    this.hp = hp;
    this.maxHp = hp;
  }
  abstract onHit(g: GameCtx, dir: number, dmg: number): void;
  /** Bosses override: a reflected candy / thrown block landed. */
  onProjectile(g: GameCtx, dir: number): void {
    this.onHit(g, dir, 1);
  }
}

export class Cage extends Hittable {
  kind = "cage";
  friend: FriendId;
  bob = 0;
  constructor(x: number, y: number, friend: FriendId) {
    super(x, y, 36, 44, 3);
    this.friend = friend;
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    this.bob += dt;
    void g;
  }
  onHit(g: GameCtx, dir: number, dmg: number): void {
    this.hp -= dmg;
    this.flash = 0.2;
    g.sfx("crack");
    g.shake(0.25);
    g.particles.burst(this.cx, this.cy, 10, ["#f9a8d4", "#fff"], { speed: 200, vx: dir * 60 });
    if (this.hp <= 0) {
      this.dead = true;
      g.particles.burst(this.cx, this.cy, 30, ["#f9a8d4", "#fde047", "#fff", FRIEND_BY_ID[this.friend].color], { speed: 320 });
      g.friendFreed(this.friend);
    }
  }
}

/** Candy cage the boss drops on the hero — Cubo bats it open. */
export class HeroCage extends Hittable {
  kind = "heroCage";
  constructor(x: number, y: number) {
    super(x, y, 40, 48, 3);
    this.layer = 2;
  }
  update(g: GameCtx, dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    const h = g.hero;
    h.body.x = this.cx - h.body.w / 2;
    h.body.y = this.body.y + this.body.h - h.body.h - 2;
    if (!g.heroCaged()) this.dead = true;
  }
  onHit(g: GameCtx, dir: number, dmg: number): void {
    this.hp -= dmg;
    this.flash = 0.2;
    g.sfx("crack");
    g.particles.burst(this.cx, this.cy, 10, ["#f9a8d4", "#fff"], { speed: 200, vx: dir * 60 });
    if (this.hp <= 0) {
      this.dead = true;
      g.particles.burst(this.cx, this.cy, 26, ["#f9a8d4", "#fde047", "#fff"], { speed: 320 });
      g.freeHero();
    }
  }
}

/** Candy shell around Cubo / the Keeper in the finale. */
export class Shell extends Hittable {
  kind = "shell";
  target: Actor;
  constructor(target: Actor) {
    super(target.body.x - 10, target.body.y - 10, target.body.w + 20, target.body.h + 14, 3);
    this.target = target;
    this.layer = 2;
  }
  update(g: GameCtx, dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    this.body.x = this.target.body.x - 10;
    this.body.y = this.target.body.y - 10;
    void g;
  }
  onHit(g: GameCtx, dir: number, dmg: number): void {
    this.hp -= dmg;
    this.flash = 0.2;
    g.sfx("crack");
    g.shake(0.25);
    g.particles.burst(this.cx, this.cy, 10, ["#fbcfe8", "#fff"], { speed: 200, vx: dir * 60 });
    if (this.hp <= 0) {
      this.dead = true;
      g.particles.burst(this.cx, this.cy, 30, ["#fbcfe8", "#fde047", "#fff"], { speed: 320 });
      if (this.target instanceof Cubo) this.target.shelled = false;
      if (this.target instanceof Npc) this.target.shelled = false;
      g.trigger("shell-cracked");
    }
  }
}

export class Orb extends Hittable {
  kind = "orb";
  bob = 0;
  falling: boolean;
  seen = false;
  constructor(x: number, y: number, falling = false) {
    super(x, y, 36, 36, falling ? 1 : 3);
    this.falling = falling;
    this.layer = 2;
  }
  update(g: GameCtx, dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    this.bob += dt;
    if (this.falling) {
      this.body.y += PHYS.tetrominoFall * dt;
      // never lost: stay within reach above the hero
      const h = g.hero;
      if (this.body.y < h.body.y - 320) this.body.y = h.body.y - 320;
      if (this.body.y > h.body.y - 40) this.body.y = h.body.y - 40;
      const floorY = g.map.pixelH - TILE * 3;
      if (this.body.y > floorY) this.body.y = floorY;
      if (g.map.overlapsSolid(this.body)) this.body.y -= TILE;
    }
    if (!this.seen && Math.abs(this.cx - g.hero.cx) < 480 && Math.abs(this.cy - g.hero.cy) < 300) {
      this.seen = true;
      g.trigger("orb-seen");
    }
    if (g.rng.next() < 0.15) g.particles.trail(this.cx + g.rng.range(-14, 14), this.cy + g.rng.range(-14, 14), "#a5f3fc");
  }
  onHit(g: GameCtx, dir: number, dmg: number): void {
    this.hp -= dmg;
    this.flash = 0.25;
    g.sfx("crack");
    g.shake(0.3);
    g.particles.burst(this.cx, this.cy, 14, ["#a5f3fc", "#fff", "#c084fc"], { speed: 240, vx: dir * 40 });
    if (this.hp <= 0) {
      this.dead = true;
      g.orbBroken(this.cx, this.cy);
    }
  }
}

export class Coin extends Actor {
  kind = "coin";
  bob: number;
  constructor(x: number, y: number) {
    super(x + 8, y + 8, 16, 16);
    this.bob = (x + y) * 0.01;
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.bob += dt;
    const h = g.hero;
    if (h.has("magnet") && dist(this.body, h.body) < 130) {
      const dx = h.cx - this.cx;
      const dy = h.cy - this.cy;
      const d = Math.hypot(dx, dy) || 1;
      this.body.x += (dx / d) * 420 * dt;
      this.body.y += (dy / d) * 420 * dt;
    }
    if (overlaps(this.body, h.body)) {
      this.dead = true;
      g.coin();
      g.sfx("coin");
      g.particles.burst(this.cx, this.cy, 6, "#fde047", { speed: 120, gravity: 0, ttl: 0.3 });
    }
  }
}

export class Checkpoint extends Actor {
  kind = "checkpoint";
  active = false;
  constructor(x: number, y: number) {
    super(x, y - TILE, TILE, TILE * 2);
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    if (!this.active && overlaps(this.body, g.hero.body)) {
      this.active = true;
      g.reachedCheckpoint(this.body.x + 4, this.body.y + this.body.h - g.hero.body.h);
      g.sfx("select");
      g.particles.burst(this.cx, this.body.y, 12, ["#4ade80", "#fff"], { speed: 160, gravity: 0 });
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
export class Enemy extends Actor {
  kind = "enemy";
  type: "walker" | "flyer" | "spiky";
  originX: number;
  originY: number;
  range: number;
  frozen = 0;
  stunned = 0;
  dir = 1;
  frozenPlatform: Platform;
  constructor(x: number, y: number, type: "walker" | "flyer" | "spiky", range = 4) {
    super(x + 2, y + 2, 28, 28);
    this.type = type;
    this.originX = x;
    this.originY = y;
    this.range = range * TILE;
    this.frozenPlatform = { x, y, w: 28, h: 28, vx: 0, vy: 0, owner: this };
  }

  platform(): Platform | null {
    if (this.frozen <= 0) return null;
    const p = this.frozenPlatform;
    p.x = this.body.x - 2;
    p.y = this.body.y - 2;
    p.w = this.body.w + 4;
    p.h = this.body.h + 4;
    p.vx = 0;
    p.vy = 0;
    return p;
  }

  stun(t: number): void {
    this.stunned = Math.max(this.stunned, t);
  }

  freeze(g: GameCtx): void {
    this.frozen = 4;
    this.vx = 0;
    this.vy = 0;
    g.particles.burst(this.cx, this.cy, 14, ["#bae6fd", "#fff"], { speed: 160 });
  }

  kill(g: GameCtx): void {
    if (this.dead) return;
    this.dead = true;
    g.sfx("stomp");
    g.particles.burst(this.cx, this.cy, 16, ["#fff", "#fda4af", "#f43f5e"], { speed: 260 });
  }

  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    const h = g.hero;
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) g.particles.burst(this.cx, this.cy, 8, "#bae6fd", { speed: 100 });
      if (this.type !== "flyer") this.physics(g, dt);
      return;
    }
    if (this.stunned > 0) {
      this.stunned -= dt;
      if (this.type !== "flyer") this.physics(g, dt);
    } else if (this.type === "flyer") {
      const t = this.anim * 1.4;
      this.body.x = this.originX + Math.sin(t) * this.range;
      this.body.y = this.originY + Math.sin(t * 2.1) * 26;
      this.facing = Math.cos(t) >= 0 ? 1 : -1;
    } else {
      const speed = this.type === "spiky" ? 60 : 85;
      this.vx = this.dir * speed;
      this.facing = this.dir;
      this.physics(g, dt);
      // turn at walls and ledges
      const aheadX = this.dir > 0 ? this.body.x + this.body.w + 2 : this.body.x - 2;
      const ledge = !g.map.solidTile(Math.floor(aheadX / TILE), Math.floor((this.body.y + this.body.h + 4) / TILE)) && g.map.get(Math.floor(aheadX / TILE), Math.floor((this.body.y + this.body.h + 4) / TILE)) !== T.ONEWAY;
      if (this.hitWall || (this.onGround && ledge) || Math.abs(this.body.x - this.originX) > this.range) this.dir *= -1;
    }
    // contact with hero
    if (h.dead2 || h.invuln > 0 || h.caged) return;
    if (!overlaps(this.body, h.body)) return;
    const stomp = h.vy > 60 && h.body.y + h.body.h < this.body.y + this.body.h * 0.6;
    if (h.pounding || h.fx.dash > 0 || (stomp && this.type !== "spiky")) {
      this.kill(g);
      if (!h.fx.dash) {
        h.vy = h.ctl.jump ? -520 : -380;
        h.doubleJumpUsed = false;
        h.pounding = false;
      }
      h.stretch = 1.3;
    } else if (this.stunned <= 0) h.hurt(g, this.cx);
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
export type ProjectileType = "candy" | "hardCandy" | "shockwave" | "freeze" | "block" | "bomb" | "beam";

export class Projectile extends Actor {
  kind = "projectile";
  type: ProjectileType;
  owner: Actor | null;
  reflected = false;
  life = 6;
  radius: number;
  constructor(x: number, y: number, type: ProjectileType, vx: number, vy: number, owner: Actor | null) {
    const size = type === "shockwave" ? 40 : type === "block" ? 24 : type === "bomb" ? 22 : 20;
    super(x - size / 2, y - size / 2, size, size);
    this.type = type;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner;
    this.radius = size / 2;
    this.layer = 2;
    if (type === "shockwave") {
      this.body.h = 26;
      this.body.w = 30;
      this.life = 4;
    }
  }

  pop(g: GameCtx): void {
    this.dead = true;
    g.sfx("pop");
    g.particles.burst(this.cx, this.cy, 10, ["#f9a8d4", "#fff", "#fb7185"], { speed: 180 });
  }

  reflect(g: GameCtx, dir: number): void {
    this.reflected = true;
    this.type = "hardCandy";
    this.life = 3;
    const speed = Math.max(420, Math.abs(this.vx) * 1.5);
    // aim straight at the boss so a good swing is always rewarded
    let boss: Actor | null = null;
    for (const e of g.entities()) if (e.kind === "boss" && !e.dead && e instanceof Actor) boss = e;
    if (boss) {
      const dx = boss.cx - this.cx;
      const dy = boss.cy - this.cy;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = (dx / d) * speed;
      this.vy = (dy / d) * speed;
    } else {
      this.vx = speed * dir;
      this.vy = -40;
    }
  }

  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    const h = g.hero;
    switch (this.type) {
      case "candy":
        this.vy += 900 * dt;
        this.body.x += this.vx * dt;
        this.body.y += this.vy * dt;
        if (g.map.overlapsSolid(this.body)) {
          if (this.vy > 0 && g.map.overlapsSolid({ ...this.body, y: this.body.y + 1 })) {
            this.body.y = Math.floor((this.body.y + this.body.h) / TILE) * TILE - this.body.h;
            this.vy = -Math.abs(this.vy) * 0.45;
            this.vx *= 0.8;
            if (Math.abs(this.vy) < 60) this.pop(g);
          } else this.pop(g);
        }
        break;
      case "hardCandy":
      case "block": {
        if (this.type === "block") this.vy += 700 * dt;
        const px = this.body.x;
        const py = this.body.y;
        this.body.x += this.vx * dt;
        this.body.y += this.vy * dt;
        if (g.map.overlapsSolid(this.body)) {
          if (this.type === "block") {
            // a miss drops the block back where it was a step ago so Cubo can try again
            this.dead = true;
            const bp = new BlockPickup(px, py);
            bp.vy = 0;
            g.add(bp);
            g.particles.burst(this.cx, this.cy, 8, "#94a3b8", { speed: 140 });
          } else this.pop(g);
        }
        break;
      }
      case "freeze":
        this.body.x += this.vx * dt;
        if (g.map.overlapsSolid(this.body)) {
          // water → ice
          this.dead = true;
          g.particles.burst(this.cx, this.cy, 8, "#bae6fd", { speed: 120 });
        }
        {
          const tx = Math.floor(this.cx / TILE);
          const ty = Math.floor(this.cy / TILE);
          if (g.map.get(tx, ty) === T.WATER) {
            for (let dx = -1; dx <= 1; dx++) if (g.map.get(tx + dx, ty) === T.WATER && g.map.get(tx + dx, ty - 1) !== T.WATER) g.map.set(tx + dx, ty, T.ICE);
            g.add(new IceTimer(tx, ty, 4));
            this.dead = true;
            g.particles.burst(this.cx, this.cy, 14, ["#bae6fd", "#fff"], { speed: 180 });
            g.sfx("freeze");
          }
        }
        for (const e of g.entities()) {
          if (e instanceof Enemy && !e.dead && e.frozen <= 0 && overlaps(e.body, this.body)) {
            e.freeze(g);
            this.dead = true;
            g.sfx("freeze");
          }
        }
        if (g.rng.next() < 0.5) g.particles.trail(this.cx, this.cy, "#bae6fd");
        return;
      case "shockwave":
        this.body.x += this.vx * dt;
        // hugs the floor
        {
          const probe: Body = { x: this.body.x, y: this.body.y + this.body.h, w: this.body.w, h: 1 };
          if (!g.map.overlapsSolid(probe)) this.body.y += 300 * dt;
          if (g.map.overlapsSolid(this.body)) this.body.y = Math.floor((this.body.y + this.body.h) / TILE) * TILE - this.body.h;
        }
        if (g.map.moveX(this.body, 0)) this.dead = true;
        if (this.body.x < 0 || this.body.x > g.map.pixelW) this.dead = true;
        if (g.rng.next() < 0.6) g.particles.trail(this.cx + g.rng.range(-12, 12), this.body.y + this.body.h - 4, "#fde68a");
        break;
      case "bomb":
        this.vy += 800 * dt;
        this.body.x += this.vx * dt;
        this.body.y += this.vy * dt;
        if (g.map.overlapsSolid(this.body)) {
          this.dead = true;
          g.sfx("bash");
          g.shake(0.4);
          g.particles.burst(this.cx, this.cy, 22, ["#f97316", "#fde047", "#fff"], { speed: 300 });
          if (dist(this.body, h.body) < 60) h.hurt(g, this.cx);
        }
        break;
      case "beam":
        this.body.y += this.vy * dt;
        break;
    }

    // hit the hero?
    if (!this.reflected && this.type !== "block" && this.type !== "beam" && !h.dead2 && overlaps(this.body, h.body)) {
      if (this.type === "candy") {
        const stomp = h.vy > 60 && h.body.y + h.body.h < this.cy;
        if (stomp || h.pounding) {
          this.pop(g);
          h.vy = -420;
          h.doubleJumpUsed = false;
          return;
        }
      }
      if (this.type !== "bomb") {
        if (h.hurt(g, this.cx) && this.type !== "shockwave") this.dead = true;
      }
    }
    // reflected / block: hit a boss
    if (this.reflected || this.type === "block") {
      for (const e of g.entities()) {
        if (e instanceof Hittable && e.kind === "boss" && !e.dead && overlaps(e.body, this.body)) {
          e.onProjectile(g, Math.sign(this.vx) || 1);
          this.dead = true;
          g.particles.burst(this.cx, this.cy, 12, "#fff", { speed: 220 });
        }
      }
    }
  }
}

/** Restores ice tiles to water after a delay. */
export class IceTimer implements EntityLike {
  layer = 0;
  dead = false;
  kind = "iceTimer";
  body: Body;
  t: number;
  tx: number;
  ty: number;
  constructor(tx: number, ty: number, t: number) {
    this.tx = tx;
    this.ty = ty;
    this.t = t;
    this.body = { x: tx * TILE, y: ty * TILE, w: 0, h: 0 };
  }
  update(g: GameCtx, dt: number): void {
    this.t -= dt;
    if (this.t <= 0) {
      for (let dx = -1; dx <= 1; dx++) if (g.map.get(this.tx + dx, this.ty) === T.ICE) g.map.set(this.tx + dx, this.ty, T.WATER);
      this.dead = true;
    }
  }
}

/** Loose block spawned by bashing a BASH tile in the finale arena — Cubo picks it up. */
export class BlockPickup extends Actor {
  kind = "block";
  restT = 0;
  constructor(x: number, y: number) {
    super(x, y, 24, 24);
    this.vy = -200;
    this.layer = 1;
  }
  update(g: GameCtx, dt: number): void {
    const c = g.cubo;
    if (c.holdingBlock === this) return;
    this.vx *= 0.9;
    this.physics(g, dt);
    // stranded on a ledge (or stuck in a wall)? tumble back down to the floor
    const floorTop = g.map.pixelH - TILE * 2;
    const stranded = this.onGround && this.body.y + this.body.h < floorTop - 8;
    const stuck = g.map.overlapsSolid(this.body);
    this.restT = stranded || stuck ? this.restT + dt : 0;
    if (this.restT > 2.5) {
      g.particles.burst(this.cx, this.cy, 8, "#94a3b8", { speed: 120 });
      this.body.y = floorTop - this.body.h - 2;
      this.body.x = clamp(this.body.x, TILE * 2, g.map.pixelW - TILE * 2);
      let tries = 0;
      while (g.map.overlapsSolid(this.body) && tries++ < 20) this.body.x += TILE;
      this.vy = 0;
      this.restT = 0;
      g.particles.burst(this.cx, this.cy, 8, "#94a3b8", { speed: 120 });
    }
    if (!c.holdingBlock && !c.shelled && overlaps(this.body, c.body)) {
      c.holdingBlock = this;
      g.sfx("select");
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
export class Mover extends Actor {
  kind = "mover";
  private ax: number;
  private ay: number;
  private bx: number;
  private by: number;
  private t = 0;
  private dir = 1;
  private speed: number;
  plat: Platform;
  constructor(x: number, y: number, w: number, dx: number, dy: number, speed: number) {
    super(x, y, w, 14);
    this.ax = x;
    this.ay = y;
    this.bx = x + dx;
    this.by = y + dy;
    this.speed = speed;
    this.layer = 0;
    this.plat = { x, y, w, h: 14, vx: 0, vy: 0, owner: this };
  }
  platform(): Platform {
    return this.plat;
  }
  update(g: GameCtx, dt: number): void {
    const len = Math.hypot(this.bx - this.ax, this.by - this.ay) || 1;
    this.t += (this.dir * this.speed * dt) / len;
    if (this.t >= 1) {
      this.t = 1;
      this.dir = -1;
    } else if (this.t <= 0) {
      this.t = 0;
      this.dir = 1;
    }
    const nx = this.ax + (this.bx - this.ax) * this.t;
    const ny = this.ay + (this.by - this.ay) * this.t;
    this.plat.vx = (nx - this.body.x) / dt;
    this.plat.vy = (ny - this.body.y) / dt;
    this.body.x = nx;
    this.body.y = ny;
    this.plat.x = nx;
    this.plat.y = ny;
    void g;
  }
}

const TETROMINOES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [1, 1, 1],
    [0, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
];
const TET_COLORS = ["#22d3ee", "#fde047", "#c084fc", "#4ade80", "#fb923c"];

export class Tetromino extends Actor {
  kind = "tetromino";
  cells: number[][];
  color: string;
  plat: Platform;
  minY: number;
  maxY: number;
  spawnW: number;
  spawnX: number;
  constructor(x: number, y: number, shape: number, spawnX: number, spawnW: number, minY: number, maxY: number) {
    const cells = TETROMINOES[shape % TETROMINOES.length];
    super(x, y, cells[0].length * TILE, cells.length * TILE);
    this.cells = cells;
    this.color = TET_COLORS[shape % TET_COLORS.length];
    this.layer = 0;
    this.vy = -PHYS.tetrominoFall;
    this.plat = { x, y, w: this.body.w, h: this.body.h, vx: 0, vy: this.vy, owner: this };
    this.minY = minY;
    this.maxY = maxY;
    this.spawnX = spawnX;
    this.spawnW = spawnW;
  }
  platform(): Platform {
    return this.plat;
  }
  update(g: GameCtx, dt: number): void {
    this.body.y += this.vy * dt;
    const h = g.hero;
    // recycle: far above the hero → reappear far below
    if (this.body.y + this.body.h < h.body.y - 700 || this.body.y < this.minY) {
      this.body.y = Math.min(this.maxY, h.body.y + 700 + g.rng.range(0, 300));
      this.body.x = this.spawnX + g.rng.range(0, Math.max(0, this.spawnW - this.body.w));
    }
    this.plat.x = this.body.x;
    this.plat.y = this.body.y;
  }
}

/** Places rising tetrominoes across a column band (Falling World). */
export class Spawner implements EntityLike {
  layer = 0;
  dead = false;
  kind = "spawner";
  body: Body;
  private done = false;
  constructor(x: number, y: number, w: number) {
    this.body = { x, y, w, h: 0 };
  }
  update(g: GameCtx): void {
    if (this.done) return;
    this.done = true;
    const H = g.map.pixelH;
    const count = Math.floor(H / 110);
    for (let i = 0; i < count; i++) {
      const y = this.body.y + 200 + i * 110 + g.rng.range(-20, 20);
      const shape = g.rng.int(0, 4);
      const x = this.body.x + g.rng.range(0, Math.max(0, this.body.w - 4 * TILE));
      g.add(new Tetromino(x, y, shape, this.body.x, this.body.w, this.body.y + 40, H - TILE * 4));
    }
    this.dead = true;
  }
}

export class BounceBlob extends Actor {
  kind = "blob";
  squish = 0;
  constructor(x: number, y: number) {
    super(x, y + 8, 32, 24);
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    this.squish = Math.max(0, this.squish - dt * 3);
    for (const a of [g.hero, g.cubo] as Actor[]) {
      if (a.vy > 0 && a.body.x + a.body.w > this.body.x && a.body.x < this.body.x + this.body.w) {
        const bottom = a.body.y + a.body.h;
        if (bottom >= this.body.y && bottom <= this.body.y + 18) {
          a.body.y = this.body.y - a.body.h;
          const hero = a instanceof Hero ? a : null;
          a.vy = PHYS.bounceV * (hero && hero.ctl.jump ? 1.25 : 0.95);
          if (hero) {
            hero.jumping = false;
            hero.doubleJumpUsed = false;
            hero.pounding = false;
            hero.stretch = 1.5;
          }
          this.squish = 1;
          g.sfx("boing");
          g.particles.burst(this.cx, this.body.y, 8, ["#f472b6", "#fff"], { speed: 200 });
        }
      }
    }
  }
}

export class Warp extends Actor {
  kind = "warp";
  tx: number;
  ty: number;
  cooldown = 0;
  constructor(x: number, y: number, tx: number, ty: number) {
    super(x, y - 4, TILE, 6);
    this.tx = tx;
    this.ty = ty;
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const h = g.hero;
    if (this.cooldown > 0 || h.dead2) return;
    const onTop = h.onGround && Math.abs(h.body.y + h.body.h - this.body.y - 4) < 6 && h.cx > this.body.x + 2 && h.cx < this.body.x + TILE - 2;
    if (onTop && h.ctl.downPressed) {
      g.sfx("portal");
      g.particles.burst(h.cx, h.cy, 12, "#4ade80", { speed: 160 });
      h.body.x = this.tx * TILE + (TILE - h.body.w) / 2;
      h.body.y = this.ty * TILE - h.body.h;
      h.vx = 0;
      h.vy = 0;
      h.invuln = Math.max(h.invuln, 0.4);
      g.camera.snapTo(h.body);
      g.cubo.teleportToHero(g);
      for (const e of g.entities()) if (e instanceof Warp) e.cooldown = 0.8;
      g.particles.burst(h.cx, h.cy, 12, "#4ade80", { speed: 160 });
    }
  }
}

export class Npc extends Actor {
  kind = "npc";
  who: "keeper" | "clank" | "friend";
  friend?: FriendId;
  lines: string[];
  lineIndex = 0;
  talkCooldown = 0;
  shelled = false;
  hidden = false;
  hover = 0;
  constructor(x: number, y: number, who: "keeper" | "clank" | "friend", lines: string[], friend?: FriendId) {
    super(x + 2, y - 4, 28, 36);
    this.who = who;
    this.lines = lines;
    this.friend = friend;
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    this.talkCooldown = Math.max(0, this.talkCooldown - dt);
    if (this.who === "keeper") this.hover = Math.sin(this.anim * 2) * 6;
    else this.physics(g, dt);
    if (this.hidden || !this.lines.length) return;
    const h = g.hero;
    if (dist(this.body, h.body) < 90 && this.talkCooldown <= 0) {
      g.say("npc", this.lines[this.lineIndex % this.lines.length], this.cx, this.body.y, 3);
      this.lineIndex++;
      this.talkCooldown = 4;
      this.facing = h.cx > this.cx ? 1 : -1;
    }
  }
}

export class Sign extends Actor {
  kind = "sign";
  text: string;
  shown = 0;
  constructor(x: number, y: number, text: string) {
    super(x, y, TILE, TILE);
    this.text = text;
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.shown = Math.max(0, this.shown - dt);
    if (this.shown <= 0 && dist(this.body, g.hero.body) < 70) {
      g.say("npc", this.text, this.cx, this.body.y, 3.5);
      this.shown = 6;
    }
  }
}

export class Portal extends Actor {
  kind = "portal";
  pid: string;
  cooldown = 0;
  active = true;
  constructor(x: number, y: number, id: string) {
    super(x - 6, y - TILE, TILE + 12, TILE * 2);
    this.pid = id;
    this.layer = 0;
  }
  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.active) return;
    if (g.rng.next() < 0.4) g.particles.trail(this.cx + g.rng.range(-10, 10), this.cy + g.rng.range(-24, 24), "#c084fc");
    const h = g.hero;
    if (this.cooldown <= 0 && !h.dead2 && overlaps(this.body, h.body) && h.ctl.upPressed) {
      this.cooldown = 1;
      g.trigger(`portal:${this.pid}`);
    }
  }
}

export class Trigger implements EntityLike {
  layer = 0;
  dead = false;
  kind = "trigger";
  body: Body;
  id: string;
  constructor(x: number, y: number, w: number, h: number, id: string) {
    this.body = { x, y, w, h };
    this.id = id;
  }
  update(g: GameCtx): void {
    if (overlaps(this.body, g.hero.body)) {
      this.dead = true;
      g.trigger(this.id);
    }
  }
}

export class GlassCage implements EntityLike {
  layer = 0;
  dead = false;
  kind = "glassCage";
  body: Body;
  friend: FriendId;
  anim = 0;
  constructor(x: number, y: number, friend: FriendId) {
    this.body = { x, y: y - TILE, w: TILE, h: TILE * 2 };
    this.friend = friend;
  }
  update(_g: GameCtx, dt: number): void {
    this.anim += dt;
  }
}
