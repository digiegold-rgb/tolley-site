import type { PortalGame } from "./model";
import { emptyControls } from "./model";
export class PortalInput {
  keys = new Set<string>();
  pressed = new Set<string>();
  dragging = false;
  orbitX = 0;
  orbitY = 0;
  touchX = 0;
  touchZ = 0;
  private lastX = 0;
  private lastY = 0;
  private buttons: boolean[] = [];
  private hadPad = false;
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
  }
  take(k: string) {
    const yes = this.pressed.has(k);
    this.pressed.delete(k);
    return yes;
  }
  attach(stage: HTMLElement, game: PortalGame, pause: () => void) {
    const codes = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "KeyX",
      "KeyE",
      "KeyC",
      "KeyQ",
      "Tab",
      "Escape",
      "ShiftLeft",
      "ShiftRight",
      "KeyF",
    ];
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("button,a,input,select")) return;
      if (codes.includes(e.code)) e.preventDefault();
      if (e.code === "Escape" && !e.repeat) {
        pause();
        return;
      }
      if (game.paused) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const pointerDown = (e: PointerEvent) => {
      if (game.paused || !(e.target instanceof HTMLCanvasElement)) return;
      stage.focus();
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging || game.paused) return;
      this.orbitX += e.clientX - this.lastX;
      this.orbitY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const end = () => {
      this.dragging = false;
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
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    stage.addEventListener("contextmenu", menu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      stage.removeEventListener("pointerdown", pointerDown);
      stage.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
      stage.removeEventListener("contextmenu", menu);
      this.clear();
    };
  }
  poll(game: PortalGame, dt: number, pause: () => void) {
    let x =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) +
      this.touchX;
    let z =
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) +
      this.touchZ;
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(
      (p) => p?.connected && p.mapping === "standard",
    );
    let heldJump = this.keys.has("Space");
    if (pad) {
      this.hadPad = true;
      const dead = (n: number) => (Math.abs(n) > 0.16 ? n : 0);
      x += dead(pad.axes[0]);
      z += dead(pad.axes[1]);
      this.orbitX += dead(pad.axes[2]) * dt * 600;
      this.orbitY += dead(pad.axes[3]) * dt * 400;
      heldJump ||= !!pad.buttons[0]?.pressed;
      const map: Record<number, string> = {
        0: "Space",
        1: "KeyC",
        2: "KeyX",
        3: "KeyE",
        4: "KeyQ",
        5: "ShiftLeft",
        8: "KeyF",
      };
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
    game.cameraYaw -= this.orbitX * 0.004;
    game.cameraPitch = Math.max(
      0.25,
      Math.min(0.95, game.cameraPitch + this.orbitY * 0.003),
    );
    this.orbitX = 0;
    this.orbitY = 0;
    if (this.take("KeyF")) game.cameraYaw = 0;
    const c = emptyControls();
    c.x = x * Math.cos(game.cameraYaw) + z * Math.sin(game.cameraYaw);
    c.z = z * Math.cos(game.cameraYaw) - x * Math.sin(game.cameraYaw);
    c.jump = this.take("Space");
    c.heldJump = heldJump;
    c.bash = this.take("KeyX");
    c.interact = this.take("KeyE");
    c.power = this.take("KeyC");
    c.cycle = this.take("KeyQ") || this.take("Tab");
    c.boost = this.take("ShiftLeft") || this.take("ShiftRight");
    return c;
  }
}
