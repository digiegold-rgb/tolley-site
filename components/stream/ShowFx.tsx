"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

// Full-screen celebration layer for the live-show product screen: confetti, firework bursts, emoji rain (one canvas,
// no libraries) plus big pop-up callouts. pointer-events: none — it never eats a click or a key.
// The animation loop only runs while something is on screen.

export type ShowFxHandle = {
  confetti: (amount?: number) => void;
  fireworks: (bursts?: number) => void;
  emojiRain: (emojis?: string[]) => void;
  callout: (text: string) => void;
  /** One random effect (what the auto-timer fires). */
  random: (callouts: string[]) => void;
};

type P = {
  kind: "confetti" | "spark" | "emoji";
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; size: number; color: string; life: number; max: number; text?: string; sway: number;
};

const COLORS = ["#ff4d6d", "#ffd166", "#2ecc71", "#4a90e2", "#c77dff", "#ff9f43", "#69e0ff", "#ffffff"];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

const ShowFx = forwardRef<ShowFxHandle>(function ShowFx(_props, ref) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const parts = useRef<P[]>([]);
  const raf = useRef<number | null>(null);
  const [pop, setPop] = useState<{ id: number; text: string; tilt: number; top: number } | null>(null);
  const popTimer = useRef<number | null>(null);

  // The frame function lives in a ref so it can re-schedule itself.
  const loopRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    loopRef.current = () => {
      const c = canvas.current;
      const g = c?.getContext("2d");
      if (!c || !g) { raf.current = null; return; }
      const W = c.width, H = c.height;
      g.clearRect(0, 0, W, H);
      const next: P[] = [];
      for (const p of parts.current) {
        p.life += 1;
        if (p.kind === "spark") { p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.06; } else { p.vy = Math.min(p.vy + 0.05, p.kind === "emoji" ? 5 : 6.5); p.x += Math.sin((p.life + p.sway) / 18) * 1.2; }
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.life > p.max || p.y > H + 60 || p.x < -80 || p.x > W + 80) continue;
        const fade = p.kind === "spark" ? Math.max(0, 1 - p.life / p.max) : Math.min(1, (p.max - p.life) / 30);
        g.save();
        g.globalAlpha = fade;
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        if (p.kind === "emoji" && p.text) {
          g.font = `${p.size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(p.text, 0, 0);
        } else if (p.kind === "spark") {
          g.fillStyle = p.color; g.shadowColor = p.color; g.shadowBlur = 12;
          g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.fill();
        } else {
          g.fillStyle = p.color;
          g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.6 + Math.abs(Math.sin(p.life / 9))));
        }
        g.restore();
        next.push(p);
      }
      parts.current = next;
      raf.current = next.length ? requestAnimationFrame(() => loopRef.current()) : null;
      if (!next.length) g.clearRect(0, 0, W, H);
    };
  }, []);

  const kick = useCallback(() => { if (raf.current === null) raf.current = requestAnimationFrame(() => loopRef.current()); }, []);

  useEffect(() => {
    function fit() {
      const c = canvas.current;
      if (!c) return;
      c.width = window.innerWidth; c.height = window.innerHeight;
    }
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      if (popTimer.current) window.clearTimeout(popTimer.current);
    };
  }, []);

  const confetti = useCallback((amount = 160) => {
    const W = canvas.current?.width ?? 1200;
    for (let i = 0; i < amount; i++) {
      parts.current.push({
        kind: "confetti", x: Math.random() * W, y: -20 - Math.random() * 300, vx: (Math.random() - 0.5) * 2.4, vy: 1.5 + Math.random() * 3,
        rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.3, size: 8 + Math.random() * 10, color: pick(COLORS), life: 0, max: 420, sway: Math.random() * 100,
      });
    }
    kick();
  }, [kick]);

  const burst = useCallback((x: number, y: number) => {
    const color = pick(COLORS), second = pick(COLORS);
    const n = 70 + Math.floor(Math.random() * 40);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, sp = 2.5 + Math.random() * 6.5;
      parts.current.push({
        kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: 0, size: 2 + Math.random() * 2.6,
        color: i % 3 === 0 ? second : color, life: 0, max: 70 + Math.random() * 50, sway: 0,
      });
    }
    kick();
  }, [kick]);

  const fireworks = useCallback((bursts = 5) => {
    const W = canvas.current?.width ?? 1200, H = canvas.current?.height ?? 800;
    for (let i = 0; i < bursts; i++) {
      window.setTimeout(() => burst(W * (0.12 + Math.random() * 0.76), H * (0.12 + Math.random() * 0.5)), i * 260 + Math.random() * 160);
    }
  }, [burst]);

  const emojiRain = useCallback((emojis = ["🔥", "💸", "⭐", "🎉", "💥", "🛒"]) => {
    const W = canvas.current?.width ?? 1200;
    for (let i = 0; i < 46; i++) {
      parts.current.push({
        kind: "emoji", x: Math.random() * W, y: -40 - Math.random() * 500, vx: (Math.random() - 0.5) * 1.2, vy: 1.6 + Math.random() * 2.6,
        rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 0.04, size: 30 + Math.random() * 34, color: "#fff", life: 0, max: 520, text: pick(emojis), sway: Math.random() * 100,
      });
    }
    kick();
  }, [kick]);

  const callout = useCallback((text: string) => {
    if (popTimer.current) window.clearTimeout(popTimer.current);
    setPop({ id: Date.now(), text, tilt: (Math.random() - 0.5) * 14, top: 12 + Math.random() * 38 });
    popTimer.current = window.setTimeout(() => setPop(null), 2600);
  }, []);

  const random = useCallback((callouts: string[]) => {
    const r = Math.random();
    if (r < 0.3) confetti();
    else if (r < 0.55) fireworks(4 + Math.floor(Math.random() * 4));
    else if (r < 0.75) emojiRain();
    else { callout(pick(callouts)); confetti(70); }
    if (r < 0.75 && Math.random() < 0.45) callout(pick(callouts));
  }, [confetti, fireworks, emojiRain, callout]);

  useImperativeHandle(ref, () => ({ confetti, fireworks, emojiRain, callout, random }), [confetti, fireworks, emojiRain, callout, random]);

  return (
    <>
      <style>{`
        @keyframes tfx-pop { 0% { transform: translate(-50%,0) scale(.2) rotate(var(--tilt)); opacity: 0 } 14% { transform: translate(-50%,0) scale(1.18) rotate(var(--tilt)); opacity: 1 }
          24% { transform: translate(-50%,0) scale(.96) rotate(var(--tilt)) } 34%,78% { transform: translate(-50%,0) scale(1) rotate(var(--tilt)); opacity: 1 }
          100% { transform: translate(-50%,-40px) scale(1.5) rotate(var(--tilt)); opacity: 0 } }
      `}</style>
      <canvas ref={canvas} aria-hidden style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 80 }} />
      {pop && (
        <div key={pop.id} aria-hidden style={{
          position: "fixed", left: "50%", top: `${pop.top}%`, zIndex: 81, pointerEvents: "none", whiteSpace: "nowrap",
          fontSize: "clamp(40px, 7vw, 120px)", fontWeight: 900, letterSpacing: 1, color: "#fff", padding: "0.1em 0.45em", borderRadius: "0.25em",
          background: "linear-gradient(100deg,#ff2d55,#ff9f0a 55%,#ffd60a)", boxShadow: "0 0 60px rgba(255,120,0,.75), 0 12px 0 rgba(0,0,0,.35)",
          textShadow: "0 4px 0 rgba(0,0,0,.35)", animation: "tfx-pop 2.6s cubic-bezier(.2,.9,.3,1.2) forwards",
          ["--tilt" as string]: `${pop.tilt}deg`,
        } as React.CSSProperties}>
          {pop.text}
        </div>
      )}
    </>
  );
});

export default ShowFx;
