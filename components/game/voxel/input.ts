/**
 * Keyboard, mouse (pointer lock or drag), standard gamepad and touch → Controls.
 * The mouse steers the camera and the reticle; the aim ray is filled in by the renderer each frame.
 */
import type { VoxelGame } from "./model";
import { emptyControls, type Controls, type Vec3 } from "./types";
import type { Settings } from "./save";

const KEYS = [
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyX", "KeyE", "KeyC", "KeyQ", "Tab",
  "Escape", "ShiftLeft", "ShiftRight", "KeyF", "KeyR", "Digit1", "Digit2", "Digit3",
];
export class VoxelInput {
  keys = new Set<string>();
  pressed = new Set<string>();
  dragging = false;
  locked = false;
  orbitX = 0;
  orbitY = 0;
  touchX = 0;
  touchZ = 0;
  wheel = 0;
  look: Settings["look"] = "lock";
  sensitivity = 1;
  invertY = false;
  aimOrigin: Vec3 | null = null;
  aimDir: Vec3 | null = null;
  private lastX = 0;
  private lastY = 0;
  private buttons: boolean[] = [];
  private hadPad = false;
  canvas: HTMLCanvasElement | null = null;
  configure(o: { look: Settings["look"]; sensitivity: number; invertY: boolean }) {
    this.look = o.look;
    this.sensitivity = o.sensitivity;
    this.invertY = o.invertY;
    if (this.look !== "lock") this.releaseLock();
  }
  setTouch(x: number, z: number) {
    this.touchX = x;
    this.touchZ = z;
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.touchX = 0;
    this.touchZ = 0;
    this.dragging = false;
    this.wheel = 0;
  }
  take(k: string) {
    const yes = this.pressed.has(k);
    this.pressed.delete(k);
    return yes;
  }
  requestLock() {
    if (this.look !== "lock" || !this.canvas || this.locked) return;
    try {
      const p = (this.canvas as HTMLCanvasElement & { requestPointerLock(o?: { unadjustedMovement?: boolean }): Promise<void> | void }).requestPointerLock({
        unadjustedMovement: true,
      });
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => this.canvas?.requestPointerLock());
    } catch {
      try {
        this.canvas.requestPointerLock();
      } catch {}
    }
  }
  releaseLock() {
    if (this.locked && typeof document !== "undefined") document.exitPointerLock?.();
  }
  attach(stage: HTMLElement, game: VoxelGame, pause: () => void) {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("button,a,input,select")) return;
      if (KEYS.includes(e.code)) e.preventDefault();
      if (e.code === "Escape" && !e.repeat) {
        pause();
        return;
      }
      if (game.paused) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const pointerDown = (e: PointerEvent) => {
      if (game.paused || !(e.target instanceof HTMLCanvasElement)) return;
      stage.focus();
      this.canvas = e.target;
      if (e.pointerType === "mouse" && this.look === "lock") {
        if (!this.locked) {
          this.requestLock();
          return;
        }
        if (e.button === 0) this.pressed.add("MouseLeft");
        if (e.button === 2) this.keys.add("MouseRight");
        return;
      }
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      e.target.setPointerCapture(e.pointerId);
    };
    const pointerUp = (e: PointerEvent) => {
      this.dragging = false;
      if (e.button === 2) this.keys.delete("MouseRight");
    };
    const move = (e: PointerEvent) => {
      if (game.paused) return;
      if (this.locked) {
        this.orbitX += e.movementX * this.sensitivity;
        this.orbitY += e.movementY * this.sensitivity * (this.invertY ? -1 : 1);
        return;
      }
      if (!this.dragging) return;
      this.orbitX += e.clientX - this.lastX;
      this.orbitY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const wheel = (e: WheelEvent) => {
      if (game.paused) return;
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    };
    const lockChange = () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas && this.canvas !== null;
      if (was && !this.locked && !game.paused) pause();
    };
    const blur = () => {
      this.clear();
      if (!game.paused) pause();
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    const menu = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    stage.addEventListener("pointerdown", pointerDown);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerlockchange", lockChange);
    stage.addEventListener("contextmenu", menu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      stage.removeEventListener("pointerdown", pointerDown);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("wheel", wheel);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerlockchange", lockChange);
      stage.removeEventListener("contextmenu", menu);
      this.releaseLock();
      this.clear();
    };
  }
  poll(game: VoxelGame, dt: number, pause: () => void): Controls {
    let x = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) + this.touchX;
    let z = Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) - Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) + this.touchZ;
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected && p.mapping === "standard");
    let heldJump = this.keys.has("Space");
    let lockOn = this.keys.has("MouseRight");
    if (pad) {
      this.hadPad = true;
      const dead = (n: number) => (Math.abs(n) > 0.16 ? n : 0);
      x += dead(pad.axes[0]);
      z += dead(pad.axes[1]);
      this.orbitX += dead(pad.axes[2]) * dt * 600;
      this.orbitY += dead(pad.axes[3]) * dt * 400 * (this.invertY ? -1 : 1);
      heldJump ||= !!pad.buttons[0]?.pressed;
      lockOn ||= !!pad.buttons[6]?.pressed;
      const map: Record<number, string> = { 0: "Space", 1: "KeyC", 2: "KeyX", 3: "KeyE", 4: "KeyQ", 5: "ShiftLeft", 7: "KeyX", 8: "KeyF", 12: "Digit1", 13: "Digit2", 14: "Digit3" };
      pad.buttons.forEach((b, i) => {
        if (b.pressed && !this.buttons[i]) {
          if (i === 9) pause();
          else if (map[i]) this.pressed.add(map[i]);
        }
        this.buttons[i] = b.pressed;
      });
    } else if (this.hadPad) {
      this.hadPad = false;
      this.buttons = [];
      pause();
    }
    game.cameraYaw -= this.orbitX * 0.0032;
    game.cameraPitch = Math.max(0.12, Math.min(1.05, game.cameraPitch + this.orbitY * 0.0026));
    this.orbitX = 0;
    this.orbitY = 0;
    if (this.take("KeyF")) game.cameraYaw = game.yaw + Math.PI;
    const c = emptyControls();
    c.x = x * Math.cos(game.cameraYaw) + z * Math.sin(game.cameraYaw);
    c.z = z * Math.cos(game.cameraYaw) - x * Math.sin(game.cameraYaw);
    c.jump = this.take("Space");
    c.heldJump = heldJump;
    c.bash = this.take("KeyX") || this.take("MouseLeft");
    c.interact = this.take("KeyE");
    c.power = this.take("KeyC");
    c.cycle = this.take("KeyQ") || this.take("Tab") || this.wheel !== 0;
    this.wheel = 0;
    c.lift = this.take("ShiftLeft") || this.take("ShiftRight");
    c.lockOn = lockOn;
    c.place = this.take("KeyR");
    c.rally = this.take("Digit1");
    c.hold = this.take("Digit2");
    c.bridge = this.take("Digit3");
    c.aimOrigin = this.aimOrigin;
    c.aimDir = this.aimDir;
    return c;
  }
}
