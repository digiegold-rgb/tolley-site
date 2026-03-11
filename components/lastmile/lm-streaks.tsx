// Speed streaks — horizontal lines flying left-to-right
// Pattern: hvac-snowflakes.tsx (particle system)

// [heightPx, yPercent, widthPx, durationSec, delaySec, opacity, color]
type StreakDef = [number, number, number, number, number, number, string];

const red = "rgba(239,68,68,0.4)";
const white = "rgba(255,255,255,0.25)";
const amber = "rgba(245,158,11,0.3)";

const S: StreakDef[] = [
  [1, 5, 120, 4, 0, 0.5, red],
  [2, 12, 180, 6, 1.2, 0.35, white],
  [1, 18, 100, 3.5, 0.5, 0.45, red],
  [1, 24, 150, 5, 2, 0.3, amber],
  [2, 30, 200, 7, 0.8, 0.25, red],
  [1, 36, 90, 3, 3, 0.5, white],
  [1, 42, 160, 5.5, 1, 0.4, red],
  [2, 48, 140, 4.5, 2.5, 0.3, amber],
  [1, 54, 110, 4, 0.3, 0.45, red],
  [1, 60, 170, 6.5, 1.8, 0.25, white],
  [2, 66, 130, 5, 3.5, 0.35, red],
  [1, 72, 190, 7.5, 0.6, 0.2, red],
  [1, 78, 100, 3.8, 2.2, 0.5, amber],
  [2, 83, 150, 5.2, 1.5, 0.3, white],
  [1, 88, 120, 4.2, 0, 0.4, red],
  [1, 93, 140, 6, 2.8, 0.3, red],
  [1, 8, 80, 3.2, 4, 0.4, white],
  [2, 15, 160, 8, 0.2, 0.2, red],
];

const STREAKS = S.map(([h, y, w, dur, delay, opacity, color]) => ({
  h,
  y,
  w,
  dur,
  delay,
  opacity,
  color,
}));

export function LmStreaks() {
  return (
    <div className="lm-streaks" aria-hidden="true">
      {STREAKS.map((s, i) => (
        <span
          key={i}
          className="lm-streak"
          style={
            {
              "--streak-h": `${s.h}px`,
              "--streak-w": `${s.w}px`,
              "--streak-y": `${s.y}%`,
              "--streak-dur": `${s.dur}s`,
              "--streak-delay": `${s.delay}s`,
              "--streak-opacity": `${s.opacity}`,
              "--streak-color": s.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
