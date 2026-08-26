/**
 * Fixed 60 Hz simulation with a render pass every animation frame.
 * Frame time is clamped to 100 ms so a hidden tab never produces a
 * catch-up burst; when the tab is hidden the rAF is cancelled outright.
 */
import { STEP } from "./types";

export function startLoop(update: (dt: number) => void, render: (alpha: number) => void): () => void {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = true;

  const frame = (now: number) => {
    if (!running) return;
    if (last === 0) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 8) acc = 0;
    render(acc / STEP);
    raf = requestAnimationFrame(frame);
  };

  const onVis = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      last = 0;
      acc = 0;
      if (running && raf === 0) raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVis);
  raf = requestAnimationFrame(frame);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVis);
  };
}
