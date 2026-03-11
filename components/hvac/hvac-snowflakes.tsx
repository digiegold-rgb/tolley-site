// [size, leftPct, durationSec, delaySec]
const S: [number, number, number, number][] = [
  [6, 2, 12, 0],   [10, 7, 18, 4],  [4, 11, 9, 2],   [14, 5, 22, 8],
  [8, 14, 14, 1],   [12, 9, 20, 11], [5, 18, 10, 3],
  [9, 22, 15, 5],   [16, 26, 24, 9], [6, 29, 11, 0],   [11, 24, 17, 7],
  [7, 31, 12, 4],   [13, 28, 21, 13],[4, 33, 8, 1],
  [10, 36, 16, 6],  [15, 40, 23, 10],[5, 43, 9, 0],    [8, 38, 13, 3],
  [12, 45, 19, 12], [6, 42, 10, 5],  [14, 47, 22, 15],
  [7, 51, 11, 2],   [11, 55, 18, 8], [16, 58, 25, 14], [5, 53, 9, 0],
  [9, 61, 14, 4],   [13, 65, 20, 10],[4, 68, 8, 1],    [10, 63, 16, 7],
  [8, 72, 13, 3],   [15, 76, 23, 12],[6, 79, 10, 0],   [12, 74, 19, 9],
  [5, 82, 9, 5],    [11, 86, 17, 11],[14, 89, 22, 16], [7, 84, 12, 2],
  [9, 92, 15, 6],   [16, 96, 24, 13],[6, 94, 10, 0],   [10, 98, 16, 4],
];

const FLAKES = S.map(([s, x, dur, delay], i) => ({
  s,
  x,
  dur,
  delay,
  anim: i % 2 === 0 ? "hvac-fall-a" : "hvac-fall-b",
}));

export function HvacSnowflakes() {
  return (
    <div className="hvac-snowflakes" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="hvac-snowflake"
          style={
            {
              "--s": `${f.s}px`,
              "--x": `${f.x}%`,
              "--dur": `${f.dur}s`,
              "--delay": `${f.delay}s`,
              "--anim": f.anim,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
