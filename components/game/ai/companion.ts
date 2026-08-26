/**
 * CuboBrain — the AI companion. Decides a state at 10 Hz, acts every step by
 * filling Cubo.ctl. Never blocks the hero (actors don't collide), never
 * blames the kid, and teleports beside the hero when it's stuck.
 */
import { TILE, dist, overlaps, type EntityLike, type GameCtx } from "../engine/types";
import { BlockPickup, HeroCage, Hittable, Portal, Projectile, emptyCuboControls, type Cubo } from "../engine/entities";
import { CUBO_LINES } from "../worlds/friends";

export type BrainState = "follow" | "wait" | "pillar" | "boost" | "bat" | "rescue" | "fetch" | "throw" | "sync";

export class CuboBrain {
  state: BrainState = "follow";
  private decideT = 0;
  private stuckT = 0;
  private losT = 0;
  private lastX = 0;
  private idleT = 14;
  private hopOnSaid = 0;
  private bashCd = 0;
  private wantMove = false;
  private jumpCd = 0;

  update(g: GameCtx, cubo: Cubo, dt: number): void {
    this.decideT -= dt;
    this.bashCd = Math.max(0, this.bashCd - dt);
    this.jumpCd = Math.max(0, this.jumpCd - dt);
    this.hopOnSaid = Math.max(0, this.hopOnSaid - dt);
    if (this.decideT <= 0) {
      this.decideT = 0.1;
      this.decide(g, cubo);
    }
    this.act(g, cubo, dt);
    this.unstick(g, cubo, dt);
    this.chatter(g, cubo, dt);
  }

  private decide(g: GameCtx, cubo: Cubo): void {
    const hero = g.hero;
    if (cubo.shelled) {
      this.state = "wait";
      return;
    }
    if (hero.caged) {
      this.state = "rescue";
      return;
    }
    // bat incoming boss candy
    for (const e of g.entities()) {
      if (e instanceof Projectile && !e.dead && e.type === "hardCandy" && !e.reflected) {
        const d = dist(e.body, cubo.body);
        const approaching = Math.sign(e.vx) === Math.sign(cubo.cx - e.cx);
        if (d < 110 && approaching) {
          this.state = "bat";
          return;
        }
      }
    }
    // finale: fetch loose blocks and throw them at the boss
    if (g.level.flags.finale) {
      if (cubo.holdingBlock) {
        this.state = "throw";
        return;
      }
      for (const e of g.entities()) if (e instanceof BlockPickup && !e.dead) {
        this.state = "fetch";
        return;
      }
    }
    // hero standing on the pillar / on Cubo → grow
    if (hero.riding && hero.riding.owner === cubo && !hero.dead2) {
      this.state = "pillar";
      return;
    }
    // hero asks for a lift (holds UP on the ground)
    if (hero.onGround && hero.ctl.up && !hero.inWater && hero.upHeld > 0.4) {
      this.state = "pillar";
      return;
    }
    // hero pressed X near Cubo and hit nothing → boost
    if (g.time - hero.bashTime < 0.06 && !hero.lastBashHit && dist(hero.body, cubo.body) < 44 && hero.onGround && cubo.onGround) {
      this.state = "boost";
      return;
    }
    // hero waiting in a portal → go stand in it too
    for (const e of g.entities()) if (e instanceof Portal && e.active && overlaps(e.body, hero.body)) {
      this.state = "sync";
      return;
    }
    const dx = hero.cx - cubo.cx;
    const dy = hero.cy - cubo.cy;
    if (Math.abs(dx) > 80 || Math.abs(dy) > 96) this.state = "follow";
    else this.state = "wait";
  }

  private act(g: GameCtx, cubo: Cubo, dt: number): void {
    const hero = g.hero;
    const c = emptyCuboControls();
    this.wantMove = false;
    const goTo = (tx: number, tolerance: number) => {
      const dx = tx - cubo.cx;
      if (Math.abs(dx) > tolerance) {
        this.wantMove = true;
        if (dx > 0) c.right = true;
        else c.left = true;
        this.jumpHeuristic(g, cubo, c, dx > 0 ? 1 : -1);
      }
    };
    switch (this.state) {
      case "wait":
        cubo.facing = hero.cx > cubo.cx ? 1 : -1;
        cubo.batNearby(g);
        break;
      case "follow": {
        // in a boss fight, stand between the hero and the boss to bat candy; otherwise trail behind
        let boss: EntityLike | null = null;
        for (const e of g.entities()) if (e.kind === "boss" && !e.dead) boss = e;
        const bossCx = boss ? boss.body.x + boss.body.w / 2 : null;
        const behind = bossCx !== null ? hero.cx + Math.sign(bossCx - hero.cx) * 56 : hero.cx - hero.facing * 40;
        goTo(behind, 24);
        // hero far above → jump
        if (hero.cy < cubo.cy - 64 && Math.abs(hero.cx - cubo.cx) < 60 && cubo.onGround && this.jumpCd <= 0) {
          c.jumpPressed = true;
          this.jumpCd = 0.4;
        }
        // hero far below and standing on a one-way → drop
        if (hero.cy > cubo.cy + 64 && cubo.onOneway) c.down = true;
        if (cubo.inWater && hero.cy < cubo.cy) c.up = true;
        break;
      }
      case "pillar": {
        const onMe = hero.riding && hero.riding.owner === cubo;
        if (onMe) {
          c.action = true;
        } else {
          goTo(hero.cx, 8);
          if (Math.abs(hero.cx - cubo.cx) <= 10 && this.hopOnSaid <= 0) {
            g.say("cubo", "Hop on top of me!", cubo.cx, cubo.body.y, 2);
            this.hopOnSaid = 5;
          }
        }
        break;
      }
      case "boost":
        cubo.boostHero(g);
        this.state = "wait";
        break;
      case "bat": {
        let target: Projectile | null = null;
        let best = Infinity;
        for (const e of g.entities()) {
          if (!(e instanceof Projectile) || e.dead || e.reflected || e.type !== "hardCandy") continue;
          const d = dist(e.body, cubo.body);
          if (d < best) {
            best = d;
            target = e;
          }
        }
        if (target) {
          cubo.facing = target.cx > cubo.cx ? 1 : -1;
          if (cubo.batNearby(g)) {
            if (g.rng.next() < 0.5) g.say("cubo", g.rng.pick(CUBO_LINES.bat), cubo.cx, cubo.body.y, 1.2);
            this.state = "wait";
          }
        } else this.state = "wait";
        break;
      }
      case "rescue": {
        let cage: HeroCage | null = null;
        for (const e of g.entities()) if (e instanceof HeroCage && !e.dead) cage = e;
        if (!cage) {
          this.state = "wait";
          break;
        }
        const side = cage.cx > cubo.cx ? -1 : 1;
        goTo(cage.cx + side * 36, 10);
        cubo.facing = cage.cx > cubo.cx ? 1 : -1;
        if (Math.abs(cage.cx - cubo.cx) < 60 && this.bashCd <= 0) {
          this.bashCd = 0.4;
          cage.onHit(g, cubo.facing, 1);
          cubo.swing = 0.2;
        }
        break;
      }
      case "fetch": {
        let blk: BlockPickup | null = null;
        let best = Infinity;
        for (const e of g.entities()) if (e instanceof BlockPickup && !e.dead) {
          // only blocks Cubo can actually walk to (roughly his own floor level)
          if (e.cy < cubo.cy - 40) continue;
          const d = dist(e.body, cubo.body);
          if (d < best) {
            best = d;
            blk = e;
          }
        }
        if (blk) goTo(blk.cx, 6);
        else cubo.facing = hero.cx > cubo.cx ? 1 : -1;
        break;
      }
      case "throw": {
        let boss: Hittable | null = null;
        for (const e of g.entities()) if (e instanceof Hittable && e.kind === "boss" && !e.dead) boss = e;
        if (!boss) {
          this.state = "wait";
          break;
        }
        const dx = boss.cx - cubo.cx;
        cubo.facing = dx > 0 ? 1 : -1;
        if (Math.abs(dx) > 260) goTo(boss.cx - Math.sign(dx) * 220, 20);
        else if (this.bashCd <= 0) {
          cubo.throwBlock(g);
          this.bashCd = 0.6;
          this.state = "wait";
        }
        break;
      }
      case "sync": {
        let portal: Portal | null = null;
        for (const e of g.entities()) if (e instanceof Portal && e.active && overlaps(e.body, hero.body)) portal = e;
        if (portal) goTo(portal.cx, 4);
        break;
      }
    }
    cubo.ctl = c;
    // stuck detection
    if (this.wantMove && Math.abs(cubo.cx - this.lastX) < 3) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastX = cubo.cx;
  }

  private jumpHeuristic(g: GameCtx, cubo: Cubo, c: ReturnType<typeof emptyCuboControls>, dir: number): void {
    if (!cubo.onGround || this.jumpCd > 0) return;
    const map = g.map;
    const b = cubo.body;
    const feetTy = Math.floor((b.y + b.h - 1) / TILE);
    const aheadTx = Math.floor((dir > 0 ? b.x + b.w + 4 : b.x - 4) / TILE);
    // step / wall ahead (1–2 tiles)
    const wall = map.solidTile(aheadTx, feetTy) || map.solidTile(aheadTx, feetTy - 1);
    // pit right ahead (1–2 tiles) — jumping earlier lands short
    let pit = false;
    for (let i = 1; i <= 2; i++) {
      const tx = Math.floor((b.x + b.w / 2) / TILE) + dir * i;
      let ground = false;
      for (let dy = 1; dy <= 3; dy++) if (map.solidTile(tx, feetTy + dy) || map.get(tx, feetTy + dy) === 2) ground = true;
      if (!ground && map.get(tx, feetTy + 1) !== 4) {
        pit = true;
        break;
      }
    }
    if (wall || pit) {
      c.jumpPressed = true;
      this.jumpCd = 0.35;
    }
  }

  private unstick(g: GameCtx, cubo: Cubo, dt: number): void {
    const hero = g.hero;
    if (hero.dead2 || cubo.shelled) return;
    const los = g.map.raycast(cubo.cx, cubo.cy, hero.cx, hero.cy);
    if (los) this.losT = 0;
    else this.losT += dt;
    const far = dist(hero.body, cubo.body) > 900;
    const inSpikes = g.map.touching(cubo.body, 5, 14);
    const stuck = this.stuckT > 2;
    const lostSight = this.losT > 3 && this.state === "follow";
    if ((far || inSpikes || stuck || lostSight) && cubo.poof <= 0 && hero.onGround) {
      cubo.teleportToHero(g, g.rng.pick(CUBO_LINES.shortcut));
      this.stuckT = 0;
      this.losT = 0;
    }
  }

  private chatter(g: GameCtx, cubo: Cubo, dt: number): void {
    this.idleT -= dt;
    if (this.idleT <= 0) {
      this.idleT = g.rng.range(12, 20);
      if (this.state === "wait" || this.state === "follow") g.say("cubo", g.rng.pick(CUBO_LINES.idle), cubo.cx, cubo.body.y, 2.5);
    }
  }
}
