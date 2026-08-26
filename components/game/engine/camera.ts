import { TILE, VH, VW, clamp, lerp, type Body } from "./types";

export class Camera {
  x = 0;
  y = 0;
  trauma = 0;
  mode: "side" | "vertical" = "side";
  private lookX = 0;
  shakeX = 0;
  shakeY = 0;
  private worldW = VW;
  private worldH = VH;
  private seed = 0;

  setWorld(w: number, h: number, mode: "side" | "vertical"): void {
    this.worldW = w;
    this.worldH = h;
    this.mode = mode;
  }

  snapTo(target: Body): void {
    this.x = target.x + target.w / 2 - VW / 2;
    this.y = target.y + target.h / 2 - VH / 2;
    this.clampToWorld();
  }

  update(target: Body, facing: number, dt: number): void {
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    this.lookX = lerp(this.lookX, facing * 90, 1 - Math.pow(0.02, dt));
    const tx = cx + this.lookX - VW / 2;
    const ty = cy - VH / 2 - (this.mode === "vertical" ? -60 : 40);
    const k = 1 - Math.pow(0.005, dt);
    this.x = lerp(this.x, tx, k);
    this.y = lerp(this.y, ty, this.mode === "vertical" ? 1 - Math.pow(0.001, dt) : k);
    this.clampToWorld();
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * 14;
    this.seed += dt * 60;
    this.shakeX = s * Math.sin(this.seed * 12.9898) * Math.cos(this.seed * 0.7);
    this.shakeY = s * Math.sin(this.seed * 78.233) * Math.cos(this.seed * 1.3);
  }

  addTrauma(a: number): void {
    this.trauma = clamp(this.trauma + a, 0, 1);
  }

  private clampToWorld(): void {
    this.x = clamp(this.x, 0, Math.max(0, this.worldW - VW));
    this.y = clamp(this.y, -TILE * 2, Math.max(-TILE * 2, this.worldH - VH));
  }

  /** Whole-pixel camera origin for crisp pixel art. */
  get ox(): number {
    return Math.round(this.x + this.shakeX);
  }
  get oy(): number {
    return Math.round(this.y + this.shakeY);
  }
}
