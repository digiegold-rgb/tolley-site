/**
 * Keyboard + touch input. Listens on window (canvas focus is never required),
 * ignores auto-repeat, and only preventDefaults keys we actually map so the
 * rest of the page keeps working. Pressed-edges are cleared once per sim step.
 */
export type Action =
  | "left"
  | "right"
  | "up"
  | "down"
  | "jump"
  | "bash"
  | "power"
  | "prev"
  | "next"
  | "pause"
  | "confirm"
  | "p2left"
  | "p2right"
  | "p2up"
  | "p2down"
  | "p2action"
  | "debugSkip"
  | "slot1"
  | "slot2"
  | "slot3"
  | "slot4"
  | "slot5"
  | "slot6"
  | "slot7"
  | "slot8"
  | "slot9";

const KEYMAP: Record<string, Action> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Space: "jump",
  KeyX: "bash",
  KeyC: "power",
  KeyQ: "prev",
  KeyE: "next",
  Escape: "pause",
  KeyP: "pause",
  Enter: "confirm",
  KeyA: "p2left",
  KeyD: "p2right",
  KeyW: "p2up",
  KeyS: "p2down",
  ShiftLeft: "p2action",
  ShiftRight: "p2action",
  KeyK: "debugSkip",
  Digit1: "slot1",
  Digit2: "slot2",
  Digit3: "slot3",
  Digit4: "slot4",
  Digit5: "slot5",
  Digit6: "slot6",
  Digit7: "slot7",
  Digit8: "slot8",
  Digit9: "slot9",
};

export class Input {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private codes = new Set<string>();
  /** Any mapped key/touch since mount — used to unlock audio. */
  onAny: (() => void) | null = null;
  private detach: (() => void) | null = null;

  attach(): void {
    if (typeof window === "undefined" || this.detach) return;
    const kd = (e: KeyboardEvent) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (e.repeat) return;
      if (!this.codes.has(e.code)) {
        this.codes.add(e.code);
        this.set(a, true);
      }
      this.onAny?.();
    };
    const ku = (e: KeyboardEvent) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      this.codes.delete(e.code);
      // If another physical key mapping to the same action is still held, keep it down.
      for (const c of this.codes) if (KEYMAP[c] === a) return;
      this.set(a, false);
    };
    const clear = () => this.clearAll();
    const vis = () => {
      if (document.hidden) this.clearAll();
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", vis);
    this.detach = () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", vis);
    };
  }

  dispose(): void {
    this.detach?.();
    this.detach = null;
    this.clearAll();
  }

  /** Programmatic set — used by the touch pad. */
  set(a: Action, on: boolean): void {
    if (on) {
      if (!this.down.has(a)) this.pressed.add(a);
      this.down.add(a);
      this.onAny?.();
    } else {
      if (this.down.has(a)) this.released.add(a);
      this.down.delete(a);
    }
  }

  /** Fire a one-frame press (touch buttons that act on tap). */
  tap(a: Action): void {
    this.pressed.add(a);
    this.onAny?.();
  }

  held(a: Action): boolean {
    return this.down.has(a);
  }
  justPressed(a: Action): boolean {
    return this.pressed.has(a);
  }
  justReleased(a: Action): boolean {
    return this.released.has(a);
  }
  /** Consume a press so no other system reacts to it this step. */
  consume(a: Action): void {
    this.pressed.delete(a);
  }

  endStep(): void {
    this.pressed.clear();
    this.released.clear();
  }

  clearAll(): void {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.codes.clear();
  }
}
