// [emoji, leftPct, durationSec, delaySec, sizePx]
const F: [string, number, number, number, number][] = [
  ["\uD83D\uDCA7", 2, 12, 0, 20],   // droplet
  ["\u2600\uFE0F", 5, 18, 7, 22],    // sun
  ["\uD83C\uDF0A", 8, 14, 3, 24],    // wave
  ["\uD83D\uDCA7", 12, 10, 1, 16],
  ["\uD83E\uDE63", 15, 20, 10, 18],  // goggles
  ["\u2600\uFE0F", 19, 16, 5, 20],
  ["\uD83C\uDF0A", 23, 11, 2, 22],
  ["\uD83D\uDCA7", 27, 17, 8, 14],
  ["\uD83D\uDEDF", 30, 22, 12, 20],  // ring buoy
  ["\uD83C\uDF0A", 34, 13, 4, 18],
  ["\u2600\uFE0F", 38, 19, 15, 24],
  ["\uD83D\uDCA7", 41, 10, 0, 16],
  ["\uD83C\uDF0A", 45, 15, 6, 20],
  ["\uD83D\uDCA7", 49, 21, 11, 18],
  ["\u2600\uFE0F", 53, 12, 3, 22],
  ["\uD83C\uDF0A", 57, 18, 9, 16],
  ["\uD83D\uDCA7", 61, 14, 1, 20],
  ["\uD83E\uDE63", 64, 20, 14, 18],
  ["\uD83C\uDF0A", 68, 11, 5, 24],
  ["\uD83D\uDCA7", 72, 17, 8, 14],
  ["\u2600\uFE0F", 76, 22, 13, 20],
  ["\uD83C\uDF0A", 79, 13, 2, 18],
  ["\uD83D\uDCA7", 83, 16, 7, 22],
  ["\uD83D\uDEDF", 87, 19, 16, 20],
  ["\uD83C\uDF0A", 91, 10, 0, 16],
  ["\u2600\uFE0F", 95, 21, 10, 24],
];

const FLOATS = F.map(([emoji, x, dur, delay, size], i) => ({
  emoji,
  x,
  dur,
  delay,
  size,
  anim: i % 2 === 0 ? "pools-float-a" : "pools-float-b",
}));

export function PoolsWaterEffects() {
  return (
    <div className="pools-floats" aria-hidden="true">
      {FLOATS.map((f, i) => (
        <span
          key={i}
          className="pools-float-item"
          style={
            {
              "--s": `${f.size}px`,
              "--x": `${f.x}%`,
              "--dur": `${f.dur}s`,
              "--delay": `${f.delay}s`,
              "--anim": f.anim,
            } as React.CSSProperties
          }
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
