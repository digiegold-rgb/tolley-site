/**
 * Boss state machines: Sugar Sultan (candy), The Whistler (dark), Captain
 * Clank (finale). Every attack telegraphs ≥0.6 s and has a safe answer.
 */
import { TILE, dist, type GameCtx } from "../engine/types";
import { Hittable, Projectile } from "../engine/entities";

type SultanState = "enter" | "idle" | "throwSoft" | "throwHard" | "cageTrap" | "slam" | "stunned" | "dying";

export class SugarSultan extends Hittable {
  kind = "boss";
  type = "sultan" as const;
  state: SultanState = "enter";
  t = 0;
  cycle = 0;
  homeX: number;
  floorY: number;
  hover = 0;
  telegraph = 0;
  trapX = 0;
  shots = 0;
  taunt = 0;
  constructor(x: number, y: number) {
    super(x, y - 40, 64, 72, 6);
    this.homeX = x;
    this.floorY = y + TILE;
    this.hp = 6;
    this.maxHp = 6;
    this.layer = 1;
  }
  get phase2(): boolean {
    return this.hp <= 3;
  }
  onHit(g: GameCtx, dir: number, dmg: number): void {
    if (this.state !== "stunned" || this.dead) return;
    this.hp -= dmg;
    this.flash = 0.2;
    g.sfx("crack");
    g.shake(0.3);
    g.particles.burst(this.cx, this.cy, 14, ["#f9a8d4", "#fff", "#fb7185"], { speed: 260, vx: dir * 80 });
    if (this.hp <= 0) this.defeat(g);
    else {
      this.state = "idle";
      this.t = 0.8;
      g.say("boss", g.rng.pick(["Ow! My sprinkles!", "How DARE you!", "That's MY candy!"]), this.cx, this.body.y, 1.5);
    }
  }
  onProjectile(g: GameCtx, dir: number): void {
    if (this.dead || this.state === "dying") return;
    this.hp -= 1;
    this.flash = 0.3;
    this.state = "stunned";
    this.t = 1.6;
    g.sfx("roar");
    g.shake(0.5);
    g.particles.burst(this.cx, this.cy, 20, ["#f9a8d4", "#fde047", "#fff"], { speed: 300, vx: dir * 80 });
    g.say("boss", "Dizzy... so dizzy...", this.cx, this.body.y, 1.4);
    if (this.hp <= 0) this.defeat(g);
  }
  private defeat(g: GameCtx): void {
    this.state = "dying";
    this.t = 1.6;
    g.sfx("victory");
    g.say("boss", "This isn't over! I'll be BACK, with more candy!", this.cx, this.body.y, 2.5);
  }
  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.telegraph = Math.max(0, this.telegraph - dt);
    this.t -= dt;
    const h = g.hero;
    this.facing = h.cx > this.cx ? 1 : -1;
    const speed = this.phase2 ? 1.5 : 1;
    // hover bob + drift toward home
    const targetX = this.state === "slam" ? this.body.x : this.homeX + Math.sin(this.anim * 0.7) * 80 - 32;
    this.body.x += (targetX - this.body.x) * Math.min(1, dt * 2 * speed);
    if (this.state !== "slam" && this.state !== "dying") this.body.y = this.floorY - this.body.h - 48 + Math.sin(this.anim * 2.2) * 10;
    switch (this.state) {
      case "enter":
        if (this.t <= 0) {
          this.state = "idle";
          this.t = 1.2;
          g.say("boss", "You TOUCHED my candy?! Thief! Nobody touches the Sultan's candy!", this.cx, this.body.y, 3);
        }
        break;
      case "idle":
        if (this.t <= 0) {
          this.cycle++;
          if (this.cycle % 3 === 0) {
            this.state = "cageTrap";
            this.t = 1.0;
            this.trapX = h.cx;
            this.telegraph = 1.0;
            g.sfx("whistle");
          } else if (this.phase2 && this.cycle % 2 === 0) {
            this.state = "slam";
            this.t = 0;
            this.vy = -620;
            this.telegraph = 0.7;
          } else {
            this.state = "throwSoft";
            this.shots = 0;
            this.t = 0.2;
          }
        }
        break;
      case "throwSoft":
        if (this.t <= 0) {
          this.shots++;
          const dx = h.cx - this.cx;
          g.add(new Projectile(this.cx + this.facing * 30, this.body.y + 20, "candy", dx * 0.9 + g.rng.range(-40, 40), -480, this));
          g.sfx("pop");
          this.t = 0.3;
          if (this.shots >= 3) {
            this.state = "throwHard";
            this.t = 0.8;
            this.telegraph = 0.8;
            g.sfx("ultraCharge");
          }
        }
        break;
      case "throwHard":
        if (this.t <= 0) {
          g.add(new Projectile(this.cx + this.facing * 34, this.cy, "hardCandy", this.facing * 320 * speed, 0, this));
          g.sfx("boost");
          g.say("boss", g.rng.pick(["Take THIS!", "Hard candy, coming through!", "Jawbreaker time!"]), this.cx, this.body.y, 1.2);
          this.state = "idle";
          this.t = 1.6 / speed;
        }
        break;
      case "cageTrap":
        if (this.t <= 0) {
          // caramel blob lands on trapX
          g.particles.burst(this.trapX, this.floorY - 20, 22, ["#f59e0b", "#fbbf24"], { speed: 200 });
          g.shake(0.4);
          g.sfx("bash");
          if (Math.abs(h.cx - this.trapX) < 44 && h.onGround && !h.dead2 && h.fx.bubble <= 0 && h.fx.dash <= 0 && !g.god) {
            g.cageHero(this.trapX, this.floorY - 48);
            g.say("boss", "Caged! Like all the other thieves!", this.cx, this.body.y, 2);
          }
          this.state = "idle";
          this.t = 1.4;
        }
        break;
      case "slam":
        this.vy += 1800 * dt;
        this.body.y += this.vy * dt;
        if (this.body.y + this.body.h >= this.floorY) {
          this.body.y = this.floorY - this.body.h;
          g.shake(0.7);
          g.sfx("bash");
          g.particles.burst(this.cx, this.floorY, 24, ["#f9a8d4", "#fff"], { speed: 300 });
          g.add(new Projectile(this.cx - 40, this.floorY - 14, "shockwave", -250, 0, this));
          g.add(new Projectile(this.cx + 40, this.floorY - 14, "shockwave", 250, 0, this));
          this.state = "idle";
          this.t = 1.2;
        }
        break;
      case "stunned":
        this.body.y += Math.sin(this.anim * 20) * 0.5;
        if (this.t <= 0) {
          this.state = "idle";
          this.t = 0.6;
        }
        break;
      case "dying":
        this.body.y += 40 * dt;
        this.body.h = Math.max(10, this.body.h - 30 * dt);
        if (g.rng.next() < 0.6) g.particles.burst(this.cx + g.rng.range(-30, 30), this.cy, 3, ["#f9a8d4", "#fb7185", "#fde047"], { speed: 120 });
        if (this.t <= 0) {
          this.dead = true;
          g.particles.confetti(this.cx, this.cy, 200);
          g.bossDefeated("sultan", this.cx, this.floorY - 120);
        }
        break;
    }
    // contact damage (not while stunned/dying)
    if (this.state !== "stunned" && this.state !== "dying" && !h.dead2 && !h.caged && dist(h.body, this.body) < 44) h.hurt(g, this.cx);
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
type WhistlerState = "hide" | "inhale" | "whistle" | "rest" | "flee" | "dying";

export class Whistler extends Hittable {
  kind = "boss";
  type = "whistler" as const;
  state: WhistlerState = "hide";
  t = 1.2;
  perches: { x: number; y: number }[];
  perch = 1;
  rings = 0;
  ringHigh = false;
  inhale = 0;
  visible = false;
  floorY: number;
  constructor(x: number, y: number) {
    super(x, y - 24, 48, 56, 5);
    this.hp = 5;
    this.maxHp = 5;
    this.floorY = y + TILE;
    this.perches = [
      { x: x - 224, y: y - 24 },
      { x, y: y - 24 - TILE * 2 },
      { x: x + 224, y: y - 24 },
    ];
  }
  get phase2(): boolean {
    return this.hp <= 2;
  }
  onHit(g: GameCtx, dir: number, dmg: number): void {
    if (this.state !== "rest" || this.dead) return;
    this.hp -= dmg;
    this.flash = 0.2;
    g.sfx("crack");
    g.shake(0.3);
    g.particles.burst(this.cx, this.cy, 14, ["#c4b5fd", "#fff"], { speed: 240, vx: dir * 80 });
    if (this.hp <= 0) {
      this.state = "dying";
      this.t = 1.5;
      g.sfx("victory");
      g.say("boss", "My whistle! My beautiful whistle... *toot*", this.cx, this.body.y, 2.5);
    } else {
      this.state = "flee";
      this.t = 0.4;
      g.say("boss", g.rng.pick(["Tweet! You'll never catch me!", "Hoo hoo! Too slow!", "Rude!"]), this.cx, this.body.y, 1.4);
    }
  }
  onProjectile(g: GameCtx, dir: number): void {
    if (this.state === "rest") this.onHit(g, dir, 1);
  }
  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.t -= dt;
    const h = g.hero;
    this.facing = h.cx > this.cx ? 1 : -1;
    switch (this.state) {
      case "hide":
        this.visible = false;
        if (this.t <= 0) {
          this.perch = (this.perch + 1 + g.rng.int(0, 1)) % 3;
          this.body.x = this.perches[this.perch].x;
          this.body.y = this.perches[this.perch].y;
          this.visible = true;
          this.state = "inhale";
          this.t = 1.0;
          this.inhale = 0;
          g.sfx("whistle");
        }
        break;
      case "inhale":
        this.inhale = 1 - Math.max(0, this.t);
        if (this.t <= 0) {
          this.state = "whistle";
          this.rings = 0;
          this.t = 0;
        }
        break;
      case "whistle":
        if (this.t <= 0 && this.rings < 3) {
          this.rings++;
          this.t = 0.35;
          this.ringHigh = this.phase2 && this.rings % 2 === 0;
          const y = this.ringHigh ? this.floorY - 86 : this.floorY - 14;
          const speed = this.phase2 ? 290 : 250;
          g.add(new Projectile(this.cx - 30, y, "shockwave", -speed, 0, this));
          g.add(new Projectile(this.cx + 30, y, "shockwave", speed, 0, this));
          g.sfx("boost");
          g.shake(0.2);
          g.particles.burst(this.cx, this.body.y + 20, 8, "#fde68a", { speed: 200, gravity: 0 });
        } else if (this.rings >= 3 && this.t <= 0) {
          this.state = "rest";
          this.t = 2.2;
          g.say("boss", g.rng.pick(["*pant* *pant*", "Whew! Big breath...", "Hoo... hoo..."]), this.cx, this.body.y, 1.6);
        }
        break;
      case "rest":
        this.body.y += Math.sin(this.anim * 6) * 0.4;
        if (this.t <= 0) {
          this.state = "flee";
          this.t = 0.3;
        }
        break;
      case "flee":
        if (this.t <= 0) {
          g.particles.burst(this.cx, this.cy, 12, "#c4b5fd", { speed: 180, gravity: 0 });
          this.state = "hide";
          this.t = 0.8;
          this.visible = false;
        }
        break;
      case "dying":
        if (g.rng.next() < 0.6) g.particles.burst(this.cx + g.rng.range(-20, 20), this.cy, 3, ["#c4b5fd", "#fde68a"], { speed: 120 });
        if (this.t <= 0) {
          this.dead = true;
          g.particles.confetti(this.cx, this.cy, 200);
          g.bossDefeated("whistler", this.perches[1].x, this.floorY - 120);
        }
        break;
    }
    if (this.visible && this.state !== "rest" && this.state !== "dying" && !h.dead2 && dist(h.body, this.body) < 40) h.hurt(g, this.cx);
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
type ClankState = "enter" | "patrol" | "dying";

export class CaptainClank extends Hittable {
  kind = "boss";
  type = "clank" as const;
  state: ClankState = "enter";
  t = 1.0;
  dir = 1;
  minX: number;
  maxX: number;
  hoverY: number;
  bombT = 2.2;
  constructor(x: number, y: number) {
    super(x, y - TILE * 7, 72, 56, 3);
    this.hp = 3;
    this.maxHp = 3;
    this.minX = x - 260;
    this.maxX = x + 260;
    this.hoverY = y - TILE * 7;
    this.layer = 1;
  }
  onHit(): void {
    /* only Cubo's thrown blocks can reach him */
  }
  onProjectile(g: GameCtx, dir: number): void {
    if (this.dead || this.state === "dying") return;
    this.hp -= 1;
    this.flash = 0.3;
    g.sfx("crack");
    g.shake(0.6);
    g.particles.burst(this.cx, this.cy, 22, ["#94a3b8", "#fde047", "#fff"], { speed: 320, vx: dir * 60 });
    if (this.hp <= 0) {
      this.state = "dying";
      this.t = 1.8;
      g.sfx("victory");
      g.say("boss", "My machine! Nooo— this is NOT in the manual!", this.cx, this.body.y, 2.5);
    } else g.say("boss", g.rng.pick(["A cube?! You let a CUBE hit me?", "Insolent blocks!", "Clank does not clank!"]), this.cx, this.body.y, 1.6);
  }
  update(g: GameCtx, dt: number): void {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.t -= dt;
    const h = g.hero;
    const speed = 120 + (this.maxHp - this.hp) * 50;
    switch (this.state) {
      case "enter":
        if (this.t <= 0) this.state = "patrol";
        break;
      case "patrol":
        this.body.x += this.dir * speed * dt;
        if (this.body.x < this.minX) this.dir = 1;
        if (this.body.x + this.body.w > this.maxX) this.dir = -1;
        this.body.y = this.hoverY + Math.sin(this.anim * 2) * 8;
        this.facing = this.dir;
        this.bombT -= dt;
        if (this.bombT <= 0) {
          this.bombT = Math.max(1.0, 1.8 - (this.maxHp - this.hp) * 0.3);
          const dx = h.cx - this.cx;
          g.add(new Projectile(this.cx, this.body.y + this.body.h, "bomb", dx * 0.6, 0, this));
          g.sfx("pop");
          g.particles.burst(this.cx, this.body.y + this.body.h, 6, "#94a3b8", { speed: 100 });
        }
        break;
      case "dying":
        this.body.y += 60 * dt;
        this.body.x += Math.sin(this.anim * 30) * 2;
        if (g.rng.next() < 0.7) g.particles.burst(this.cx + g.rng.range(-30, 30), this.cy, 3, ["#f97316", "#94a3b8"], { speed: 140 });
        if (this.t <= 0) {
          this.dead = true;
          g.particles.confetti(this.cx, this.cy, 260);
          g.bossDefeated("clank", this.cx, this.hoverY + TILE * 5);
        }
        break;
    }
    if (this.state === "patrol" && !h.dead2 && dist(h.body, this.body) < 50) h.hurt(g, this.cx);
  }
}
