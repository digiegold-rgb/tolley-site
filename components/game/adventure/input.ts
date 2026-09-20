import { AdventureGame } from './model';

export class AdventureInput {
  keys = new Set<string>();
  pressed = new Set<string>();
  orbitX = 0;
  orbitY = 0;
  moveX = 0;
  moveZ = 0;
  guard = false;
  private buttons: boolean[] = [];
  private padConnected = false;
  attach(element: HTMLElement, game: AdventureGame, pause: () => void) {
    const handled = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ', 'KeyH', 'KeyR', 'KeyF', 'Tab', 'Escape'];
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('button,input,select,a')) return;
      if (handled.includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' && !e.repeat) { pause(); return; }
      if (game.paused) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const mouseDown = (e: PointerEvent) => {
      if (game.paused || !(e.target instanceof HTMLCanvasElement)) return;
      element.focus();
      if (e.button === 0) this.pressed.add('attack');
      if (e.button === 2) this.keys.add('shield');
      if (!document.pointerLockElement) void element.requestPointerLock?.()?.catch(() => {});
    };
    const mouseUp = () => this.keys.delete('shield');
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement === element && !game.paused) { this.orbitX += e.movementX; this.orbitY += e.movementY; }
    };
    const menu = (e: Event) => e.preventDefault();
    const blur = () => { this.clear(); if (!game.paused) pause(); };
    const visibility = () => { if (document.hidden) blur(); };
    const lock = () => { if (!document.pointerLockElement && !game.paused) blur(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    element.addEventListener('pointerdown', mouseDown); window.addEventListener('pointerup', mouseUp);
    window.addEventListener('mousemove', move); element.addEventListener('contextmenu', menu);
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility); document.addEventListener('pointerlockchange', lock);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      element.removeEventListener('pointerdown', mouseDown); window.removeEventListener('pointerup', mouseUp);
      window.removeEventListener('mousemove', move); element.removeEventListener('contextmenu', menu);
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('pointerlockchange', lock);
      this.clear();
    };
  }
  clear() { this.keys.clear(); this.pressed.clear(); this.guard = false; this.moveX = 0; this.moveZ = 0; this.orbitX = 0; this.orbitY = 0; }
  take(key: string) { const result = this.pressed.has(key); this.pressed.delete(key); return result; }
  poll(dt: number, pause: () => void) {
    this.moveX = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    this.moveZ = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    this.guard = this.keys.has('shield');
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(p => p?.connected && p.mapping === 'standard');
    if (!pad) { if (this.padConnected) pause(); this.padConnected = false; this.buttons = []; return; }
    this.padConnected = true;
    const dead = (n: number) => Math.abs(n) > .18 ? n : 0;
    this.moveX += dead(pad.axes[0] ?? 0); this.moveZ -= dead(pad.axes[1] ?? 0);
    this.orbitX += dead(pad.axes[2] ?? 0) * dt * 1000;
    this.orbitY += dead(pad.axes[3] ?? 0) * dt * 700;
    this.guard ||= !!pad.buttons[6]?.pressed;
    const mapping: Record<number, string> = { 0: 'Space', 1: 'ShiftLeft', 2: 'attack', 3: 'KeyE', 4: 'Tab', 5: 'KeyQ', 8: 'KeyH', 10: 'KeyF', 12: 'KeyR' };
    pad.buttons.forEach((button, i) => {
      if (button.pressed && !this.buttons[i]) { if (i === 9) pause(); else if (mapping[i]) this.pressed.add(mapping[i]); }
      this.buttons[i] = button.pressed;
    });
  }
}

/** Short original synthesized effects: no remote audio requests or autoplay. */
export class AdventureAudio {
  private context: AudioContext | null = null;
  unlock() {
    try { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); } catch { /* audio is optional */ }
  }
  play(kind: 'hit' | 'reward' | 'hurt' | 'throw', muted: boolean) {
    const ctx = this.context; if (!ctx || ctx.state !== 'running' || muted) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    const frequency = { hit: 170, reward: 660, hurt: 110, throw: 440 }[kind];
    osc.type = kind === 'reward' ? 'sine' : 'triangle'; osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * (kind === 'reward' ? 1.5 : .5), ctx.currentTime + .16);
    gain.gain.setValueAtTime(.06, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .22);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .23);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  dispose() { void this.context?.close().catch(() => {}); this.context = null; }
}
