import type { Rng } from "./types";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: string;
  gravity: number;
  shape: "square" | "spark" | "ring" | "confetti";
  rot: number;
  spin: number;
}

export class Particles {
  list: Particle[] = [];
  private rng: Rng;
  constructor(rng: Rng) {
    this.rng = rng;
  }

  burst(x: number, y: number, n: number, color: string | string[], opts: Partial<Particle> & { speed?: number } = {}): void {
    const speed = opts.speed ?? 180;
    for (let i = 0; i < n; i++) {
      if (this.list.length > 900) this.list.shift();
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(speed * 0.3, speed);
      const ttl = opts.ttl ?? this.rng.range(0.35, 0.8);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s + (opts.vx ?? 0),
        vy: Math.sin(a) * s + (opts.vy ?? 0),
        life: ttl,
        ttl,
        size: opts.size ?? this.rng.range(3, 6),
        color: Array.isArray(color) ? this.rng.pick(color) : color,
        gravity: opts.gravity ?? 600,
        shape: opts.shape ?? "square",
        rot: this.rng.range(0, 6.28),
        spin: this.rng.range(-8, 8),
      });
    }
  }

  confetti(x: number, y: number, n: number): void {
    this.burst(x, y, n, ["#ff5e78", "#ffd93d", "#5ef2a5", "#52c3ff", "#c77dff", "#ff9f43"], {
      speed: 520,
      ttl: 2.6,
      gravity: 420,
      shape: "confetti",
      size: 6,
      vy: -300,
    });
  }

  trail(x: number, y: number, color: string): void {
    if (this.list.length > 900) this.list.shift();
    this.list.push({
      x,
      y,
      vx: this.rng.range(-30, 30),
      vy: this.rng.range(-30, 30),
      life: 0.4,
      ttl: 0.4,
      size: 4,
      color,
      gravity: 0,
      shape: "spark",
      rot: 0,
      spin: 0,
    });
  }

  update(dt: number): void {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) {
        l[i] = l[l.length - 1];
        l.pop();
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.shape === "confetti") p.vx *= 0.995;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  clear(): void {
    this.list.length = 0;
  }
}
