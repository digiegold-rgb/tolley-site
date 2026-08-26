/**
 * Canvas renderer. Letterboxes a 960×540 stage, draws parallax → tiles →
 * entities by layer → particles → darkness mask → speech bubbles → HUD.
 * Pixel art stays crisp: DPR ≤ 2, no smoothing, whole-pixel camera.
 */
import { T, TILE, VH, VW, clamp, type Bubble, type EntityLike, type FriendId, type LevelDef, type Light, type PowerId } from "./types";
import type { Camera } from "./camera";
import type { Tilemap } from "./tilemap";
import type { Particles } from "./particles";
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
  Tetromino,
  Warp,
} from "./entities";
import { SugarSultan, Whistler, CaptainClank } from "../worlds/bosses";
import { crownSprite, cuboSprite, enemySprite, heroSprite, type HeroFrame } from "./sprites";
import { FRIEND_BY_ID, FRIEND_BY_POWER } from "../worlds/friends";

export interface HudState {
  levelName: string;
  rescued: FriendId[];
  coins: number;
  hearts: number;
  maxHearts: number;
  activeSlots: PowerId[];
  selected: number;
  cooldowns: Partial<Record<PowerId, number>>;
  passives: PowerId[];
  touch: boolean;
  prompt: string | null;
}

export interface Scene {
  level: LevelDef;
  map: Tilemap;
  camera: Camera;
  entities: EntityLike[];
  particles: Particles;
  bubbles: Bubble[];
  lights: Light[];
  hero: Hero;
  cubo: Cubo;
  time: number;
  hud: HudState;
  letterbox: number; // 0..1 cutscene bars
  flash: number;
}

const POWER_ICON: Record<PowerId, string> = {
  doubleJump: "⇈",
  glide: "≋",
  magnet: "U",
  pound: "▼",
  bubble: "○",
  shield: "◐",
  shrink: "▫",
  wallCling: "⌐",
  rocket: "▲",
  dash: "»",
  glow: "☼",
  freeze: "❄",
  slowTime: "◔",
  speed: "⚡",
  megaPunch: "✊",
};

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale = 1;
  offX = 0;
  offY = 0;
  dpr = 1;
  font = "system-ui, sans-serif";
  private dark: HTMLCanvasElement | null = null;
  private darkCtx: CanvasRenderingContext2D | null = null;
  private bgSeed: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    for (let i = 0; i < 120; i++) this.bgSeed.push(((i * 9301 + 49297) % 233280) / 233280);
  }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.scale = Math.min(cssW / VW, cssH / VH);
    this.offX = (cssW - VW * this.scale) / 2;
    this.offY = (cssH - VH * this.scale) / 2;
  }

  /** Stage-space → CSS px (for DOM overlays that need to line up). */
  stageRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.offX, y: this.offY, w: VW * this.scale, h: VH * this.scale };
  }

  draw(s: Scene): void {
    const ctx = this.ctx;
    const { canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05030f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.offX * this.dpr, this.offY * this.dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();

    this.drawBackground(s);

    const flipped = !!s.level.flags.flipped;
    ctx.save();
    if (flipped) {
      ctx.translate(0, VH);
      ctx.scale(1, -1);
    }
    const cam = s.camera;
    ctx.translate(-cam.ox, -cam.oy);
    this.drawTiles(s);
    for (let layer = 0; layer <= 2; layer++) for (const e of s.entities) if (e.layer === layer && !e.dead) this.drawEntity(s, e);
    this.drawParticles(s);
    ctx.restore();

    if (s.level.flags.dark) this.drawDarkness(s, flipped);
    this.drawBubbles(s, flipped);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, s.flash)})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    this.drawHud(s);
    if (s.letterbox > 0) {
      ctx.fillStyle = "#000";
      const h = 70 * s.letterbox;
      ctx.fillRect(0, 0, VW, h);
      ctx.fillRect(0, VH - h, VW, h);
    }
    ctx.restore();
  }

  /* ── background ─────────────────────────────────────────────────────── */
  private drawBackground(s: Scene): void {
    const ctx = this.ctx;
    const p = s.level.palette;
    const grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, p.sky);
    grad.addColorStop(1, p.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);
    const cam = s.camera;
    // far layer: stars / dots
    ctx.fillStyle = p.star;
    for (let i = 0; i < 60; i++) {
      const sx = ((this.bgSeed[i] * 2400 - cam.x * 0.15) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      const sy = ((this.bgSeed[(i + 37) % 120] * 900 - cam.y * 0.1) % (VH + 40) + VH + 40) % (VH + 40) - 20;
      const tw = 0.6 + 0.4 * Math.sin(s.time * 2 + i);
      const sz = i % 5 === 0 ? 4 : 2;
      ctx.globalAlpha = tw;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha = 1;
    // mid layer: soft hills / blobs
    ctx.fillStyle = p.groundDark;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 12; i++) {
      const w = 220 + this.bgSeed[i + 60] * 260;
      const h = 90 + this.bgSeed[i + 70] * 120;
      const sx = ((i * 380 - cam.x * 0.35) % (VW + w) + VW + w) % (VW + w) - w;
      const sy = VH - h + 30 - cam.y * 0.2 + (s.level.cameraMode === "vertical" ? ((cam.y * 0.3) % 400) : 0);
      ctx.beginPath();
      ctx.ellipse(sx + w / 2, sy + h, w / 2, h, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ── tiles ──────────────────────────────────────────────────────────── */
  private drawTiles(s: Scene): void {
    const ctx = this.ctx;
    const map = s.map;
    const cam = s.camera;
    const p = s.level.palette;
    const x0 = Math.max(0, Math.floor(cam.ox / TILE) - 1);
    const x1 = Math.min(map.w - 1, Math.ceil((cam.ox + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.oy / TILE) - 1);
    const y1 = Math.min(map.h - 1, Math.ceil((cam.oy + VH) / TILE) + 1);
    const t = s.time;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const k = map.get(tx, ty);
        if (k === T.AIR) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        switch (k) {
          case T.SOLID: {
            const top = map.get(tx, ty - 1) !== T.SOLID;
            ctx.fillStyle = p.ground;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = p.groundDark;
            ctx.fillRect(x, y + TILE - 6, TILE, 6);
            ctx.fillRect(x + TILE - 4, y, 4, TILE);
            if (top) {
              ctx.fillStyle = p.accent;
              ctx.fillRect(x, y, TILE, 6);
              ctx.fillStyle = "rgba(255,255,255,0.25)";
              ctx.fillRect(x, y, TILE, 2);
            }
            break;
          }
          case T.ONEWAY:
            ctx.fillStyle = p.accent;
            ctx.fillRect(x, y, TILE, 8);
            ctx.fillStyle = p.groundDark;
            ctx.fillRect(x, y + 8, TILE, 3);
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.fillRect(x + 2, y, TILE - 4, 2);
            break;
          case T.BASH:
            ctx.fillStyle = p.bash;
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(x + 1, y + TILE - 7, TILE - 2, 6);
            ctx.fillRect(x + TILE - 7, y + 1, 6, TILE - 2);
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.fillRect(x + 4, y + 4, TILE - 12, 3);
            ctx.fillRect(x + 4, y + 4, 3, TILE - 12);
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 12);
            ctx.lineTo(x + 18, y + 18);
            ctx.lineTo(x + 14, y + 24);
            ctx.stroke();
            break;
          case T.WATER: {
            const surface = map.get(tx, ty - 1) !== T.WATER && map.get(tx, ty - 1) !== T.ICE;
            ctx.fillStyle = "rgba(56,189,248,0.55)";
            ctx.fillRect(x, y, TILE, TILE);
            if (surface) {
              ctx.fillStyle = "rgba(224,242,254,0.8)";
              const wave = Math.sin(t * 3 + tx) * 2;
              ctx.fillRect(x, y + 2 + wave, TILE, 3);
            }
            break;
          }
          case T.ICE:
            ctx.fillStyle = "#bae6fd";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = "#e0f2fe";
            ctx.fillRect(x, y, TILE, 5);
            ctx.fillStyle = "rgba(14,116,144,0.5)";
            ctx.fillRect(x, y + TILE - 5, TILE, 5);
            break;
          case T.SPIKE:
            ctx.fillStyle = "#e2e8f0";
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(x + i * 8, y + TILE);
              ctx.lineTo(x + i * 8 + 4, y + 10);
              ctx.lineTo(x + i * 8 + 8, y + TILE);
              ctx.closePath();
              ctx.fill();
            }
            ctx.fillStyle = "#64748b";
            ctx.fillRect(x, y + TILE - 4, TILE, 4);
            break;
          case T.BOUNCE: {
            const sq = 1 + Math.sin(t * 8 + tx) * 0.05;
            ctx.fillStyle = "#f472b6";
            ctx.fillRect(x, y + TILE * (1 - sq) + 4, TILE, TILE * sq - 4);
            ctx.fillStyle = "#fbcfe8";
            ctx.fillRect(x + 2, y + TILE * (1 - sq) + 4, TILE - 4, 6);
            ctx.fillStyle = "#9d174d";
            ctx.fillRect(x, y + TILE - 5, TILE, 5);
            break;
          }
          case T.PIPE: {
            const top = map.get(tx, ty - 1) !== T.PIPE;
            ctx.fillStyle = "#22c55e";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = "#166534";
            ctx.fillRect(x + TILE - 6, y, 6, TILE);
            ctx.fillStyle = "#86efac";
            ctx.fillRect(x + 3, y, 4, TILE);
            if (top) {
              ctx.fillStyle = "#15803d";
              ctx.fillRect(x - 2, y, TILE + 4, 10);
              ctx.fillStyle = "#bbf7d0";
              ctx.fillRect(x - 2, y, TILE + 4, 3);
            }
            break;
          }
          case T.GOO: {
            ctx.fillStyle = "#ec4899";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = "#f472b6";
            ctx.fillRect(x, y + 6, TILE, TILE - 6);
            ctx.fillStyle = "#fbcfe8";
            for (let i = 0; i < 3; i++) {
              const bx = x + 4 + i * 11;
              const by = y + 6 + Math.sin(t * 2 + tx + i) * 3;
              ctx.beginPath();
              ctx.arc(bx + 3, by + 4, 5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = "#be185d";
            ctx.fillRect(x, y + TILE - 5, TILE, 5);
            break;
          }
          case T.GLASS:
            ctx.fillStyle = "rgba(186,230,253,0.35)";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
            break;
        }
      }
    }
  }

  /* ── entities ───────────────────────────────────────────────────────── */
  private drawEntity(s: Scene, e: EntityLike): void {
    const ctx = this.ctx;
    const b = e.body;
    if (e instanceof Hero) return this.drawHero(s, e);
    if (e instanceof Cubo) return this.drawCubo(s, e);
    if (e instanceof Cage) return this.drawCage(s, e);
    if (e instanceof HeroCage) return this.drawHeroCage(s, e);
    if (e instanceof Shell) return this.drawShell(s, e);
    if (e instanceof Orb) return this.drawOrb(s, e);
    if (e instanceof Coin) {
      const sx = Math.abs(Math.cos(e.bob * 4));
      const y = b.y + Math.sin(e.bob * 3) * 2;
      ctx.fillStyle = "#b45309";
      ctx.fillRect(e.cx - 8 * sx, y, 16 * sx, 16);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(e.cx - 7 * sx, y + 1, 14 * sx, 14);
      ctx.fillStyle = "#fef9c3";
      ctx.fillRect(e.cx - 4 * sx, y + 3, 4 * sx, 6);
      return;
    }
    if (e instanceof Checkpoint) {
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(b.x + 6, b.y + 4, 4, b.h - 4);
      ctx.fillStyle = e.active ? "#4ade80" : "#f87171";
      const wave = Math.sin(e.anim * 6) * 2;
      ctx.beginPath();
      ctx.moveTo(b.x + 10, b.y + 6);
      ctx.lineTo(b.x + 30 + wave, b.y + 13);
      ctx.lineTo(b.x + 10, b.y + 20);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (e instanceof Enemy) return this.drawEnemy(s, e);
    if (e instanceof Projectile) return this.drawProjectile(s, e);
    if (e instanceof Tetromino) {
      for (let r = 0; r < e.cells.length; r++)
        for (let c = 0; c < e.cells[r].length; c++) {
          if (!e.cells[r][c]) continue;
          const x = b.x + c * TILE;
          const y = b.y + r * TILE;
          ctx.fillStyle = e.color;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillRect(x, y, 5, TILE);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x, y + TILE - 5, TILE, 5);
          ctx.fillRect(x + TILE - 5, y, 5, TILE);
        }
      return;
    }
    if (e instanceof Mover) {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(b.x, b.y, b.w, 4);
      ctx.fillStyle = "#334155";
      for (let x = b.x + 4; x < b.x + b.w - 4; x += 12) ctx.fillRect(x, b.y + 7, 6, 4);
      return;
    }
    if (e instanceof BounceBlob) {
      const sq = 1 - e.squish * 0.4;
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.ellipse(e.cx, b.y + b.h - (b.h * sq) / 2, (b.w / 2) * (1 + e.squish * 0.3), (b.h / 2) * sq, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(e.cx - 8, b.y + 6, 4, 4);
      ctx.fillRect(e.cx + 4, b.y + 6, 4, 4);
      return;
    }
    if (e instanceof Warp) {
      const bob = Math.sin(s.time * 4) * 3;
      ctx.fillStyle = "#fef9c3";
      ctx.beginPath();
      ctx.moveTo(b.x + 10, b.y - 26 + bob);
      ctx.lineTo(b.x + 22, b.y - 26 + bob);
      ctx.lineTo(b.x + 16, b.y - 16 + bob);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (e instanceof Npc) return this.drawNpc(s, e);
    if (e instanceof Sign) {
      ctx.fillStyle = "#92400e";
      ctx.fillRect(b.x + 14, b.y + 14, 4, 18);
      ctx.fillStyle = "#d97706";
      ctx.fillRect(b.x + 2, b.y + 2, 28, 16);
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(b.x + 6, b.y + 6, 20, 2);
      ctx.fillRect(b.x + 6, b.y + 11, 14, 2);
      return;
    }
    if (e instanceof Portal) {
      const t = s.time * 3;
      ctx.save();
      ctx.globalAlpha = e.active ? 0.9 : 0.35;
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = i % 2 ? "#c084fc" : "#a5f3fc";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(e.cx, e.cy, 12 + i * 4 + Math.sin(t + i) * 2, 28 + i * 3, Math.sin(t * 0.5 + i) * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(192,132,252,0.35)";
      ctx.beginPath();
      ctx.ellipse(e.cx, e.cy, 12, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (e instanceof GlassCage) {
      ctx.fillStyle = "rgba(186,230,253,0.3)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      this.drawFriendFace(e.friend, b.x + b.w / 2, b.y + b.h - 22 + Math.sin(e.anim * 2) * 2, 22);
      ctx.fillStyle = "#475569";
      ctx.fillRect(b.x - 2, b.y + b.h - 4, b.w + 4, 6);
      return;
    }
    if (e instanceof BlockPickup) {
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(b.x, b.y, b.w, 4);
      ctx.fillStyle = "#475569";
      ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
      return;
    }
    if (e instanceof SugarSultan) return this.drawSultan(s, e);
    if (e instanceof Whistler) return this.drawWhistler(s, e);
    if (e instanceof CaptainClank) return this.drawClank(s, e);
  }

  private blit(img: HTMLCanvasElement | null, cx: number, bottom: number, facing: number, sx = 1, sy = 1, alpha = 1): void {
    if (!img) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(cx), Math.round(bottom));
    ctx.scale(facing < 0 ? -sx : sx, sy);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  private drawHero(s: Scene, h: Hero): void {
    const ctx = this.ctx;
    const b = h.body;
    if (h.invuln > 0 && !h.dead2 && Math.floor(s.time * 20) % 2 === 0 && h.caged === false) return;
    let frame: HeroFrame = "idle";
    if (h.dead2 || h.hurtTimer > 0) frame = "hurt";
    else if (h.inWater) frame = "swim";
    else if (!h.onGround) frame = h.vy < 0 ? "jump" : "fall";
    else if (Math.abs(h.vx) > 30) frame = Math.floor(h.anim * 8) % 2 === 0 ? "run1" : "run2";
    const img = heroSprite(h.heroKind, frame);
    const shrink = h.fx.shrink > 0 ? 0.5 : 1;
    const bottom = b.y + b.h;
    // ultra charge glow
    if (h.ultraCharge > 0.08) {
      const k = h.ultraCharge / 0.5;
      ctx.fillStyle = `rgba(253,224,71,${0.15 + k * 0.25})`;
      ctx.beginPath();
      ctx.arc(h.cx, bottom - 14, 22 + k * 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(h.cx - 18, b.y - 16, 36, 6);
      ctx.fillStyle = h.ultraReady ? "#fff" : "#fde047";
      ctx.fillRect(h.cx - 17, b.y - 15, 34 * k, 4);
    }
    if (h.fx.bubble > 0) {
      ctx.fillStyle = "rgba(251,191,36,0.25)";
      ctx.beginPath();
      ctx.arc(h.cx, h.cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (h.has("shield") && h.fx.shieldReady) {
      ctx.strokeStyle = `rgba(74,222,128,${0.5 + Math.sin(s.time * 4) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.cx, h.cy, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.blit(img, h.cx, bottom, h.facing, h.squash * shrink, h.stretch * shrink);
    if (h.gliding) {
      ctx.fillStyle = "rgba(196,181,253,0.8)";
      ctx.beginPath();
      ctx.ellipse(h.cx - 16 * h.facing, b.y + 6, 12, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(h.cx + 16 * h.facing, b.y + 6, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (h.bashAnim > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(h.cx + h.facing * 22, h.cy - 2, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (h.wallSlide !== 0) {
      ctx.fillStyle = "#a3e635";
      ctx.fillRect(h.cx + h.wallSlide * 10, b.y + 8, 3, 10);
    }
    if (h.has("glow") || s.level.flags.dark) s.lights.push({ x: h.cx, y: h.cy, r: h.has("glow") ? 150 : 60, color: "#fde047" });
  }

  private drawCubo(s: Scene, c: Cubo): void {
    const ctx = this.ctx;
    const b = c.body;
    const frame = c.hurtTimer > 0 ? "hurt" : c.throwT > 0 || c.swing > 0 ? "throw" : c.blink < 0 ? "blink" : "idle";
    if (c.pillarH > 0) {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(b.x, b.y - c.pillarH, b.w, c.pillarH + b.h);
      ctx.fillStyle = "#ca8a04";
      ctx.fillRect(b.x + b.w - 4, b.y - c.pillarH, 4, c.pillarH + b.h);
      ctx.fillStyle = "#fef08a";
      for (let y = b.y + b.h - 8; y > b.y - c.pillarH; y -= 16) ctx.fillRect(b.x + 3, y, 4, 4);
    }
    const top = b.y - c.pillarH + b.h;
    this.blit(cuboSprite(frame), c.cx, top + 4, c.facing, 1, 1, c.poof > 0 ? 0.5 : 1);
    if (c.swing > 0) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, 30, c.facing > 0 ? -1 : Math.PI - 1, c.facing > 0 ? 1 : Math.PI + 1);
      ctx.stroke();
    }
    if (c.poof > 0) {
      ctx.fillStyle = `rgba(253,224,71,${c.poof})`;
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, 30 * (1 - c.poof), 0, Math.PI * 2);
      ctx.fill();
    }
    s.lights.push({ x: c.cx, y: c.cy - c.pillarH, r: 160, color: "#fde047" });
  }

  private drawCage(s: Scene, c: Cage): void {
    const ctx = this.ctx;
    const b = c.body;
    const f = FRIEND_BY_ID[c.friend];
    const y = b.y + Math.sin(c.bob * 2) * 2;
    ctx.fillStyle = "rgba(15,23,42,0.35)";
    ctx.fillRect(b.x + 2, y + 2, b.w, b.h);
    this.drawFriendFace(c.friend, c.cx, y + 12, 22);
    ctx.fillStyle = f.color;
    ctx.fillRect(c.cx - 8, y + 24, 16, 12);
    const bars = c.flash > 0 ? "#fff" : "#f472b6";
    ctx.fillStyle = bars;
    ctx.fillRect(b.x, y, b.w, 5);
    ctx.fillRect(b.x, y + b.h - 5, b.w, 5);
    for (let i = 0; i <= 3; i++) ctx.fillRect(b.x + i * 10.5, y, 4, b.h);
    ctx.fillStyle = "#fbcfe8";
    ctx.fillRect(b.x, y, b.w, 2);
    // cracks
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    for (let i = 0; i < c.maxHp - c.hp; i++) {
      ctx.beginPath();
      ctx.moveTo(b.x + 6 + i * 10, y + 10);
      ctx.lineTo(b.x + 12 + i * 10, y + 20 + i * 5);
      ctx.stroke();
    }
    if (s.level.flags.dark) s.lights.push({ x: c.cx, y: c.cy, r: 70, color: f.color });
  }

  private drawHeroCage(s: Scene, c: HeroCage): void {
    const ctx = this.ctx;
    const b = c.body;
    ctx.fillStyle = "rgba(244,114,182,0.25)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = c.flash > 0 ? "#fff" : "#f472b6";
    ctx.fillRect(b.x, b.y, b.w, 5);
    ctx.fillRect(b.x, b.y + b.h - 5, b.w, 5);
    for (let i = 0; i <= 4; i++) ctx.fillRect(b.x + i * 9, b.y, 4, b.h);
    void s;
  }

  private drawShell(s: Scene, sh: Shell): void {
    const ctx = this.ctx;
    const b = sh.body;
    ctx.fillStyle = sh.flash > 0 ? "rgba(255,255,255,0.9)" : "rgba(251,207,232,0.85)";
    ctx.beginPath();
    ctx.ellipse(sh.cx, sh.cy, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#831843";
    ctx.lineWidth = 2;
    for (let i = 0; i < sh.maxHp - sh.hp; i++) {
      ctx.beginPath();
      ctx.moveTo(sh.cx - 10 + i * 8, b.y + 10);
      ctx.lineTo(sh.cx - 4 + i * 8, b.y + 24);
      ctx.lineTo(sh.cx - 8 + i * 8, b.y + 38);
      ctx.stroke();
    }
    void s;
  }

  private drawOrb(s: Scene, o: Orb): void {
    const ctx = this.ctx;
    const y = o.cy + Math.sin(o.bob * 2.5) * 5;
    const pulse = 1 + Math.sin(s.time * 5) * 0.08;
    ctx.fillStyle = "rgba(165,243,252,0.25)";
    ctx.beginPath();
    ctx.arc(o.cx, y, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(o.cx - 5, y - 5, 2, o.cx, y, 18);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.5, o.flash > 0 ? "#fff" : "#a5f3fc");
    g.addColorStop(1, "#7c3aed");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.cx, y, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(o.cx, y, 26, 8, s.time * 2, 0, Math.PI * 2);
    ctx.stroke();
    s.lights.push({ x: o.cx, y, r: 140, color: "#a5f3fc" });
  }

  private drawEnemy(s: Scene, e: Enemy): void {
    const ctx = this.ctx;
    const b = e.body;
    const img = enemySprite(e.type, Math.floor(e.anim * 6), e.frozen > 0);
    const bob = e.type === "flyer" ? 0 : 0;
    this.blit(img, e.cx, b.y + b.h + 2 + bob, e.facing, 1, e.stunned > 0 ? 0.8 : 1);
    if (e.frozen > 0) {
      ctx.fillStyle = "rgba(186,230,253,0.45)";
      ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    }
    if (e.stunned > 0) {
      ctx.fillStyle = "#fde047";
      for (let i = 0; i < 3; i++) {
        const a = s.time * 6 + (i * Math.PI * 2) / 3;
        ctx.fillRect(e.cx + Math.cos(a) * 14 - 2, b.y - 6 + Math.sin(a) * 4, 4, 4);
      }
    }
  }

  private drawProjectile(s: Scene, p: Projectile): void {
    const ctx = this.ctx;
    const b = p.body;
    switch (p.type) {
      case "candy":
        ctx.fillStyle = "#f9a8d4";
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.cx - 3, p.cy - 6, 3, 3);
        break;
      case "hardCandy":
        ctx.save();
        ctx.translate(p.cx, p.cy);
        ctx.rotate(p.anim * 12);
        ctx.fillStyle = p.reflected ? "#fde047" : "#ef4444";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(-10, -3, 20, 6);
        ctx.restore();
        break;
      case "shockwave": {
        ctx.fillStyle = "rgba(253,230,138,0.85)";
        ctx.beginPath();
        ctx.ellipse(p.cx, b.y + b.h - 8, b.w / 2, 12 + Math.sin(s.time * 20) * 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        s.lights.push({ x: p.cx, y: p.cy, r: 90, color: "#fde68a" });
        break;
      }
      case "freeze":
        ctx.fillStyle = "#bae6fd";
        ctx.beginPath();
        ctx.moveTo(p.cx + Math.sign(p.vx) * 12, p.cy);
        ctx.lineTo(p.cx - Math.sign(p.vx) * 8, p.cy - 6);
        ctx.lineTo(p.cx - Math.sign(p.vx) * 8, p.cy + 6);
        ctx.closePath();
        ctx.fill();
        break;
      case "block":
        ctx.save();
        ctx.translate(p.cx, p.cy);
        ctx.rotate(p.anim * 8);
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(-12, -12, 24, 24);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(-12, -12, 24, 4);
        ctx.restore();
        break;
      case "bomb":
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = Math.floor(s.time * 10) % 2 ? "#f97316" : "#fde047";
        ctx.fillRect(p.cx - 2, p.cy - 16, 4, 6);
        break;
      case "beam":
        ctx.fillStyle = "rgba(192,132,252,0.5)";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        break;
    }
  }

  private drawNpc(s: Scene, n: Npc): void {
    const ctx = this.ctx;
    const b = n.body;
    if (n.hidden) return;
    const y = b.y + n.hover;
    if (n.who === "keeper") {
      ctx.fillStyle = "rgba(192,132,252,0.3)";
      ctx.beginPath();
      ctx.ellipse(n.cx, y + b.h + 4, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.moveTo(n.cx - 14, y + b.h);
      ctx.lineTo(n.cx - 8, y + 10);
      ctx.lineTo(n.cx + 8, y + 10);
      ctx.lineTo(n.cx + 14, y + b.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f5d0fe";
      ctx.beginPath();
      ctx.arc(n.cx, y + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#312e81";
      ctx.fillRect(n.cx - 5, y + 8, 3, 3);
      ctx.fillRect(n.cx + 2, y + 8, 3, 3);
      const crown = crownSprite();
      if (crown) ctx.drawImage(crown, n.cx - crown.width / 2, y - 6);
      s.lights.push({ x: n.cx, y: y + 20, r: 120, color: "#c084fc" });
    } else if (n.who === "clank") {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(b.x, y + 10, b.w, b.h - 10);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(b.x + 2, y, b.w - 4, 14);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(n.cx - 6 * n.facing - 2, y + 4, 6, 5);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(n.cx - 1, y - 8, 2, 8);
      ctx.fillRect(n.cx - 3, y - 11, 6, 4);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(b.x + 4, y + 18, b.w - 8, 3);
      ctx.fillRect(b.x + 4, y + 26, b.w - 8, 3);
    } else if (n.friend) {
      this.drawFriendFace(n.friend, n.cx, y + 6, 24);
      ctx.fillStyle = FRIEND_BY_ID[n.friend].color;
      ctx.fillRect(n.cx - 8, y + 20, 16, 14);
    }
  }

  drawFriendFace(id: FriendId, cx: number, y: number, size: number): void {
    const ctx = this.ctx;
    const f = FRIEND_BY_ID[id];
    const r = size / 2;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // simple animal markers
    ctx.fillStyle = f.color;
    if (["gecko", "pixel", "bolt", "dash", "bam", "skye"].includes(id)) {
      ctx.fillRect(cx - r + 1, y - 4, 6, 8);
      ctx.fillRect(cx + r - 7, y - 4, 6, 8);
    } else if (["zippy", "magnus", "frosty", "flutter", "lumen"].includes(id)) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(cx - 2, y + r + 2, 5, 3);
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - 6, y + r - 4, 4, 5);
    ctx.fillRect(cx + 2, y + r - 4, 4, 5);
    ctx.fillStyle = "#111827";
    ctx.fillRect(cx - 5, y + r - 3, 2, 3);
    ctx.fillRect(cx + 3, y + r - 3, 2, 3);
  }

  private drawSultan(s: Scene, b: SugarSultan): void {
    const ctx = this.ctx;
    const body = b.body;
    const flash = b.flash > 0 || (b.telegraph > 0 && Math.floor(s.time * 12) % 2 === 0);
    if (b.state === "cageTrap") {
      const k = 1 - Math.max(0, b.t);
      ctx.fillStyle = `rgba(245,158,11,${0.3 + k * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(b.trapX, b.floorY - 4, 20 + k * 30, 6 + k * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#be185d";
    ctx.beginPath();
    ctx.moveTo(b.cx - b.facing * 20, body.y + 20);
    ctx.lineTo(b.cx - b.facing * 46, body.y + body.h + 6);
    ctx.lineTo(b.cx - b.facing * 4, body.y + body.h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = flash ? "#fff" : b.state === "stunned" ? "#fbcfe8" : "#f472b6";
    ctx.beginPath();
    ctx.ellipse(b.cx, b.cy + 6, 32, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(b.cx - 10, b.cy - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 6; i++) ctx.fillRect(b.cx - 26 + i * 10, b.cy + 20 + (i % 2) * 6, 4, 4);
    ctx.fillStyle = "#fff";
    ctx.fillRect(b.cx - 14 + b.facing * 4, b.cy - 8, 9, 10);
    ctx.fillRect(b.cx + 5 + b.facing * 4, b.cy - 8, 9, 10);
    ctx.fillStyle = "#111827";
    const ex = b.state === "stunned" ? Math.sin(s.time * 20) * 3 : b.facing * 3;
    ctx.fillRect(b.cx - 11 + ex, b.cy - 5, 4, 5);
    ctx.fillRect(b.cx + 8 + ex, b.cy - 5, 4, 5);
    ctx.fillStyle = "#831843";
    ctx.fillRect(b.cx - 8, b.cy + 8, 16, 3);
    const crown = crownSprite();
    if (crown) {
      ctx.save();
      ctx.translate(b.cx, body.y - 4);
      ctx.scale(1.6, 1.6);
      ctx.drawImage(crown, -crown.width / 2, 0);
      ctx.restore();
    }
    this.drawBossBar(s, "SUGAR SULTAN", b.hp, b.maxHp, "#f472b6");
  }

  private drawWhistler(s: Scene, w: Whistler): void {
    if (!w.visible) return;
    const ctx = this.ctx;
    const body = w.body;
    const cheek = 1 + w.inhale * 0.6;
    if (w.state === "inhale") {
      ctx.strokeStyle = `rgba(253,230,138,${0.4 + w.inhale * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w.cx, w.cy, 20 + w.inhale * 90, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = w.flash > 0 ? "#fff" : "#7c3aed";
    ctx.beginPath();
    ctx.ellipse(w.cx, w.cy + 4, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c4b5fd";
    ctx.beginPath();
    ctx.ellipse(w.cx - 16 * w.facing, w.cy + 8, 10 * cheek, 9 * cheek, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ddd6fe";
    ctx.beginPath();
    ctx.ellipse(w.cx, w.cy + 10, 12, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(w.cx - 8, w.cy - 6, 8, 0, Math.PI * 2);
    ctx.arc(w.cx + 8, w.cy - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(w.cx - 8 + w.facing * 2, w.cy - 6, 3, 0, Math.PI * 2);
    ctx.arc(w.cx + 8 + w.facing * 2, w.cy - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(w.cx + w.facing * 6, w.cy - 1, 14 * w.facing, 5);
    ctx.fillStyle = "#4c1d95";
    ctx.beginPath();
    ctx.moveTo(w.cx - 18, body.y + 6);
    ctx.lineTo(w.cx - 12, body.y - 8);
    ctx.lineTo(w.cx - 6, body.y + 6);
    ctx.moveTo(w.cx + 18, body.y + 6);
    ctx.lineTo(w.cx + 12, body.y - 8);
    ctx.lineTo(w.cx + 6, body.y + 6);
    ctx.fill();
    s.lights.push({ x: w.cx, y: w.cy, r: w.state === "rest" ? 180 : 100 + w.inhale * 140, color: "#c4b5fd" });
    this.drawBossBar(s, "THE WHISTLER", w.hp, w.maxHp, "#c4b5fd");
  }

  private drawClank(s: Scene, c: CaptainClank): void {
    const ctx = this.ctx;
    const b = c.body;
    // hovering machine
    ctx.fillStyle = c.flash > 0 ? "#fff" : "#475569";
    ctx.fillRect(b.x, b.y + 20, b.w, b.h - 20);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(b.x + 4, b.y + 24, b.w - 8, 6);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(b.x + 8, b.y + 36, 12, 8);
    ctx.fillRect(b.x + b.w - 20, b.y + 36, 12, 8);
    // propellers
    ctx.fillStyle = "#cbd5e1";
    const spin = Math.sin(s.time * 40) * 14;
    ctx.fillRect(b.x + 10 - Math.abs(spin), b.y + 12, Math.abs(spin) * 2 + 2, 3);
    ctx.fillRect(b.x + b.w - 12 - Math.abs(spin), b.y + 12, Math.abs(spin) * 2 + 2, 3);
    ctx.fillRect(b.x + 10, b.y + 12, 2, 10);
    ctx.fillRect(b.x + b.w - 12, b.y + 12, 2, 10);
    // Clank himself
    ctx.fillStyle = "#64748b";
    ctx.fillRect(c.cx - 12, b.y - 6, 24, 28);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(c.cx - 10, b.y - 14, 20, 12);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(c.cx - 6 + c.facing * 3, b.y - 11, 6, 5);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(c.cx - 1, b.y - 22, 2, 8);
    ctx.fillRect(c.cx - 3, b.y - 25, 6, 4);
    this.drawBossBar(s, "CAPTAIN CLANK", c.hp, c.maxHp, "#94a3b8");
  }

  private bossBar: { name: string; hp: number; max: number; color: string } | null = null;
  private drawBossBar(s: Scene, name: string, hp: number, max: number, color: string): void {
    this.bossBar = { name, hp, max, color };
    void s;
  }

  /* ── particles ──────────────────────────────────────────────────────── */
  private drawParticles(s: Scene): void {
    const ctx = this.ctx;
    for (const p of s.particles.list) {
      const a = clamp(p.life / p.ttl, 0, 1);
      ctx.globalAlpha = p.shape === "confetti" ? Math.min(1, a * 3) : a;
      ctx.fillStyle = p.color;
      if (p.shape === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 - a) * 30 + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /* ── darkness ───────────────────────────────────────────────────────── */
  private drawDarkness(s: Scene, flipped: boolean): void {
    if (!this.dark) {
      this.dark = document.createElement("canvas");
      this.dark.width = VW;
      this.dark.height = VH;
      this.darkCtx = this.dark.getContext("2d");
    }
    const d = this.darkCtx;
    if (!d) return;
    d.globalCompositeOperation = "source-over";
    d.fillStyle = "rgba(4,3,18,0.9)";
    d.fillRect(0, 0, VW, VH);
    d.globalCompositeOperation = "destination-out";
    const cam = s.camera;
    for (const l of s.lights) {
      const sx = l.x - cam.ox;
      const sy = flipped ? VH - (l.y - cam.oy) : l.y - cam.oy;
      const g = d.createRadialGradient(sx, sy, 0, sx, sy, l.r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.55, "rgba(0,0,0,0.85)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = g;
      d.fillRect(sx - l.r, sy - l.r, l.r * 2, l.r * 2);
    }
    this.ctx.drawImage(this.dark, 0, 0);
  }

  /* ── bubbles ────────────────────────────────────────────────────────── */
  private drawBubbles(s: Scene, flipped: boolean): void {
    const ctx = this.ctx;
    const cam = s.camera;
    ctx.font = `600 15px ${this.font}`;
    ctx.textBaseline = "middle";
    for (const b of s.bubbles) {
      const sx = b.x - cam.ox;
      const sy = flipped ? VH - (b.y - cam.oy) + 30 : b.y - cam.oy - 14;
      const lines = wrap(ctx, b.text, 250);
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22;
      const h = lines.length * 19 + 14;
      const x = clamp(sx - w / 2, 8, VW - w - 8);
      const y = clamp(sy - h - 10, 8, VH - h - 8);
      const fade = b.ttl < 0.3 ? b.ttl / 0.3 : 1;
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      roundRect(ctx, x, y, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.beginPath();
      ctx.moveTo(clamp(sx - 8, x + 10, x + w - 26), y + h - 1);
      ctx.lineTo(clamp(sx, x + 18, x + w - 18), y + h + 9);
      ctx.lineTo(clamp(sx + 8, x + 26, x + w - 10), y + h - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1e1b4b";
      lines.forEach((l, i) => ctx.fillText(l, x + 11, y + 16 + i * 19));
      ctx.globalAlpha = 1;
    }
  }

  /* ── HUD ────────────────────────────────────────────────────────────── */
  private drawHud(s: Scene): void {
    const ctx = this.ctx;
    const h = s.hud;
    ctx.textBaseline = "middle";
    // world name + hearts
    ctx.font = `700 20px ${this.font}`;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, 12, 12, ctx.measureText(h.levelName).width + 24, 34, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(h.levelName, 24, 29);
    for (let i = 0; i < h.maxHearts; i++) drawHeart(ctx, 24 + i * 26, 60, i < h.hearts ? "#f87171" : "rgba(255,255,255,0.25)");
    // friends
    const fw = 15 * 24;
    const fx = VW / 2 - fw / 2;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, fx - 10, 12, fw + 20, 34, 10);
    ctx.fill();
    const order: FriendId[] = ["zippy", "flutter", "magnus", "thump", "bubbles", "shelly", "pixel", "gecko", "skye", "dash", "lumen", "frosty", "tock", "bolt", "bam"];
    order.forEach((id, i) => {
      const x = fx + i * 24 + 12;
      if (h.rescued.includes(id)) this.drawFriendFace(id, x, 20, 18);
      else {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.arc(x, 29, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // coins
    ctx.font = `700 20px ${this.font}`;
    ctx.textAlign = "right";
    const coinText = `${h.coins}`;
    const cw = ctx.measureText(coinText).width + 50;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, VW - 12 - cw, 12, cw, 34, 10);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(VW - 12 - cw + 20, 29, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(coinText, VW - 24, 29);
    // boss bar
    if (this.bossBar) {
      const bb = this.bossBar;
      const w = 320;
      const x = VW / 2 - w / 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, x - 6, 54, w + 12, 30, 8);
      ctx.fill();
      ctx.font = `700 13px ${this.font}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.fillText(bb.name, x, 64);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x, 72, w, 8);
      ctx.fillStyle = bb.color;
      ctx.fillRect(x, 72, (w * bb.hp) / bb.max, 8);
      this.bossBar = null;
    }
    // power wheel
    if (h.activeSlots.length || h.passives.length) {
      const slotW = 44;
      const total = h.activeSlots.length * slotW;
      const x0 = VW / 2 - total / 2;
      const y = VH - (h.touch ? 118 : 46);
      h.activeSlots.forEach((p, i) => {
        const f = FRIEND_BY_POWER[p];
        const x = x0 + i * slotW + slotW / 2;
        const sel = i === h.selected;
        const cd = h.cooldowns[p] ?? 0;
        ctx.fillStyle = sel ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.arc(x, y, sel ? 20 : 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(x, y, sel ? 16 : 13, 0, Math.PI * 2);
        ctx.fill();
        if (cd > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd / 8));
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "#111827";
        ctx.font = `700 ${sel ? 16 : 13}px ${this.font}`;
        ctx.textAlign = "center";
        ctx.fillText(POWER_ICON[p], x, y + 1);
        ctx.fillStyle = "#fff";
        ctx.font = `700 11px ${this.font}`;
        ctx.fillText(`${i + 1}`, x, y - 26);
        if (sel) {
          ctx.font = `700 13px ${this.font}`;
          ctx.fillStyle = "#fff";
          ctx.fillText(`${f.powerName} (C)`, x, y + 32);
        }
      });
      // passives, small, bottom-left
      h.passives.forEach((p, i) => {
        const f = FRIEND_BY_POWER[p];
        const x = 24 + i * 26;
        const y = VH - (h.touch ? 150 : 24);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111827";
        ctx.font = `700 11px ${this.font}`;
        ctx.textAlign = "center";
        ctx.fillText(POWER_ICON[p], x, y + 1);
      });
    }
    if (h.prompt) {
      ctx.font = `700 18px ${this.font}`;
      ctx.textAlign = "center";
      const w = ctx.measureText(h.prompt).width + 30;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, VW / 2 - w / 2, VH - (h.touch ? 190 : 100), w, 34, 10);
      ctx.fill();
      ctx.fillStyle = "#fde047";
      ctx.fillText(h.prompt, VW / 2, VH - (h.touch ? 173 : 83));
    }
    ctx.textAlign = "left";
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.bezierCurveTo(x - 12, y - 2, x - 6, y - 10, x, y - 3);
  ctx.bezierCurveTo(x + 6, y - 10, x + 12, y - 2, x, y + 8);
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
