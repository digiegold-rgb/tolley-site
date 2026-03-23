"use client";

import { useMemo } from "react";

const HEART_CHARS = ["💗", "💖", "💕", "🩷", "🤍", "💜"];

export function FoodSparkles() {
  const hearts = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const seed = (i * 7 + 3) % 100;
      return {
        id: i,
        char: HEART_CHARS[i % HEART_CHARS.length],
        x: `${(seed * 37) % 100}%`,
        size: `${1.0 + (seed % 5) * 0.4}rem`,
        delay: `${(i * 1.7) % 12}s`,
        duration: `${10 + (seed % 8)}s`,
        anim: i % 2 === 0 ? "food-float-a" : "food-float-b",
      };
    });
  }, []);

  return (
    <div className="food-hearts" aria-hidden="true">
      {hearts.map((h) => (
        <div
          key={h.id}
          className="food-heart"
          style={{
            "--x": h.x,
            "--s": h.size,
            "--delay": h.delay,
            "--dur": h.duration,
            "--anim": h.anim,
          } as React.CSSProperties}
        >
          {h.char}
        </div>
      ))}
    </div>
  );
}
