"use client";

import { useEffect, useState } from "react";

interface Props {
  value: number | null; // -100 to +100
}

export default function MomentumGauge({ value }: Props) {
  const [animatedAngle, setAnimatedAngle] = useState(0);
  const target = value ?? 0;
  // Map -100..+100 to 0..180 degrees
  const targetAngle = ((target + 100) / 200) * 180;

  useEffect(() => {
    setAnimatedAngle(targetAngle);
  }, [targetAngle]);

  // Arc params
  const cx = 100;
  const cy = 90;
  const r = 70;

  // Build arc path from 180 to 0 degrees (left to right)
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Gradient stops for the arc (red → yellow → green)
  const gradientId = "momentumGrad";

  // Needle endpoint
  const needleAngle = (180 - animatedAngle) * (Math.PI / 180);
  const needleX = cx + r * 0.85 * Math.cos(needleAngle);
  const needleY = cy - r * 0.85 * Math.sin(needleAngle);

  const label =
    target > 30 ? "Strong Buy" :
    target > 10 ? "Bullish" :
    target > -10 ? "Neutral" :
    target > -30 ? "Bearish" :
    "Strong Sell";

  const labelColor =
    target > 30 ? "#22c55e" :
    target > 10 ? "#4ade80" :
    target > -10 ? "#eab308" :
    target > -30 ? "#f97316" :
    "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {/* Background arc */}
        <path d={arcPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" />
        {/* Gradient arc */}
        <path d={arcPath} fill="none" stroke={`url(#${gradientId})`} strokeWidth="14" strokeLinecap="round" />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transition: "all 1s ease-out" }}
        />
        <circle cx={cx} cy={cy} r="5" fill="white" />
        {/* Value */}
        <text x={cx} y={cy - 18} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
          {value !== null ? Math.round(target) : "—"}
        </text>
        {/* Label ticks */}
        <text x={cx - r + 5} y={cy + 16} textAnchor="start" fill="rgba(255,255,255,0.3)" fontSize="8">-100</text>
        <text x={cx} y={cy - r + 18} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">0</text>
        <text x={cx + r - 5} y={cy + 16} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8">+100</text>
      </svg>
      <span className="text-[10px] font-medium mt-1" style={{ color: labelColor }}>
        {label}
      </span>
      <span className="text-[10px] text-white/40">Momentum</span>
    </div>
  );
}
