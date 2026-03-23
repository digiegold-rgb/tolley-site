"use client";

import { useState, useEffect, useRef } from "react";

const CONFETTI_COLORS = [
  "#f472b6", // pink
  "#c084fc", // lavender
  "#6ee7b7", // mint
  "#fdba74", // peach
  "#e8b4b8", // rose-gold
];

interface ConfettiPiece {
  id: number;
  left: string;
  top: string;
  color: string;
  delay: string;
  rotation: string;
}

interface FoodConfettiProps {
  active: boolean;
}

export function FoodConfetti({ active }: FoodConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const count = 30 + Math.floor(Math.random() * 11); // 30-40 pieces
    const newPieces: ConfettiPiece[] = Array.from({ length: count }, (_, i) => ({
      id: counterRef.current++,
      left: `${Math.random() * 100}%`,
      top: `${-5 + Math.random() * 10}%`,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: `${Math.random() * 0.5}s`,
      rotation: `${Math.random() * 360}deg`,
    }));

    setPieces(newPieces);

    const timer = setTimeout(() => {
      setPieces([]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="food-confetti-piece"
          style={{
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            animationDelay: p.delay,
            transform: `rotate(${p.rotation})`,
          }}
        />
      ))}
    </>
  );
}
