"use client";

import { useState } from "react";
import type { FanDayPoint, FanEffectPoint, HeatDayPoint, HeatSeriesPoint } from "@/lib/heat/types";
import { formatChicagoTime, formatCostRange, formatGap, formatKwh, formatRuntime, formatShortDate, formatTemp, formatUsd } from "@/lib/heat/format";

const W = 360;

function tempsOf(points: HeatSeriesPoint[]): number[] {
  return points.flatMap((p) => [p.kitchenF, p.loftF, p.outdoorF].filter((n): n is number => n != null));
}

export function TempChart({ points }: { points: HeatSeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return <p className="text-sm text-white/50">Not enough readings in the last 24 hours.</p>;
  }
  const padL = 36;
  const padR = 10;
  const padT = 14;
  const padB = 22;
  const h = 200;
  const times = points.map((p) => Date.parse(p.t));
  const t0 = times[0];
  const t1 = times[times.length - 1] || t0 + 1;
  const vals = tempsOf(points);
  const min = Math.min(...vals) - 2;
  const max = Math.max(...vals) + 2;
  const span = max - min || 1;
  const x = (t: number) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / span) * (h - padT - padB);
  const bands = (key: "upstairsHeat" | "downstairsHeat") => {
    const rects: { x: number; w: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      if (!points[i][key]) continue;
      const left = x(times[i]);
      const right = x(times[i + 1]);
      rects.push({ x: left, w: Math.max(0.5, right - left) });
    }
    return rects;
  };
  const path = (pick: (p: HeatSeriesPoint) => number | null) => {
    let d = "";
    let drawing = false;
    points.forEach((p, i) => {
      const v = pick(p);
      if (v == null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${x(times[i]).toFixed(1)},${y(v).toFixed(1)} `;
      drawing = true;
    });
    return d.trim();
  };
  const active = points[hover ?? points.length - 1];
  function move(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    times.forEach((t, i) => {
      const dist = Math.abs(x(t) - px);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    setHover(best);
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${h}`}
        className="h-[220px] w-full touch-pan-y"
        role="img"
        aria-label="Kitchen, loft, and outdoor temperature for the last 24 hours. Shaded bands mark when each furnace was heating."
        onPointerMove={(e) => move(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((step) => {
          const value = min + span * step;
          const yy = y(value);
          return (
            <g key={step}>
              <line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="rgba(255,255,255,0.08)" />
              <text x={0} y={yy + 3} fill="rgba(255,255,255,0.45)" fontSize="10">
                {Math.round(value)}°
              </text>
            </g>
          );
        })}
        {bands("downstairsHeat").map((rect, i) => (
          <rect key={`d${i}`} x={rect.x} y={padT} width={rect.w} height={h - padT - padB} fill="rgba(122,162,255,0.28)" />
        ))}
        {bands("upstairsHeat").map((rect, i) => (
          <rect key={`u${i}`} x={rect.x} y={padT} width={rect.w} height={h - padT - padB} fill="rgba(232,160,74,0.32)" />
        ))}
        <path d={path((p) => p.outdoorF)} fill="none" stroke="#7dd3fc" strokeWidth="1.6" />
        <path d={path((p) => p.loftF)} fill="none" stroke="#c4b5fd" strokeWidth="1.8" />
        <path d={path((p) => p.kitchenF)} fill="none" stroke="#f8f3ff" strokeWidth="2" />
        {hover != null && (
          <line x1={x(times[hover])} x2={x(times[hover])} y1={padT} y2={h - padB} stroke="rgba(255,255,255,0.45)" />
        )}
      </svg>
      <p className="mt-1 text-xs text-white/70">
        {formatChicagoTime(active.t)} · Kitchen {formatTemp(active.kitchenF)} · Loft {formatTemp(active.loftF)} · Outdoor{" "}
        {formatTemp(active.outdoorF)}
        {active.upstairsHeat ? " · Upstairs heating" : ""}
        {active.downstairsHeat ? " · Downstairs heating" : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#f8f3ff]" /> Kitchen</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#c4b5fd]" /> Loft</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#7dd3fc]" /> Outdoor</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#e8a04a]/80" /> Upstairs heat</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#7aa2ff]/80" /> Downstairs heat</span>
      </div>
    </div>
  );
}

export function DailyChart({ days }: { days: HeatDayPoint[] }) {
  const shown = days.slice(-30);
  const [hover, setHover] = useState<number | null>(null);
  if (!shown.length) return <p className="text-sm text-white/50">No daily rows yet.</p>;
  const padL = 32;
  const padR = 36;
  const top = 150;
  const h = 214;
  const inner = W - padL - padR;
  const slot = inner / shown.length;
  const maxHours = Math.max(1, ...shown.map((d) => d.upstairsHeatH + d.downstairsHeatH));
  const costs = shown.map((d) => d.costMid).filter((n): n is number => n != null);
  const maxCost = Math.max(1, ...costs, 0);
  const hdds = shown.map((d) => d.hdd65).filter((n): n is number => n != null);
  const maxHdd = Math.max(1, ...hdds, 0);
  const yHour = (v: number) => 12 + (1 - v / (maxHours * 1.15)) * (top - 28);
  const yCost = (v: number) => 12 + (1 - v / (maxCost * 1.15)) * (top - 28);
  const yHdd = (v: number) => 168 + (1 - v / (maxHdd * 1.1)) * 36;
  const costPath = shown
    .map((d, i) => (d.costMid == null ? null : `${i === 0 || shown[i - 1]?.costMid == null ? "M" : "L"}${(padL + slot * i + slot / 2).toFixed(1)},${yCost(d.costMid).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const active = shown[hover ?? shown.length - 1];

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: shown.length > 18 ? 560 : "100%" }}>
        <svg viewBox={`0 0 ${W} ${h}`} className="h-[230px] w-full touch-pan-y" role="img" aria-label="Daily heat hours by furnace, estimated gas cost, and outdoor heating degree-days.">
          <line x1={padL} x2={W - padR} y1={yHour(0)} y2={yHour(0)} stroke="rgba(255,255,255,0.12)" />
          {shown.map((d, i) => {
            const x = padL + slot * i + slot * 0.18;
            const bw = slot * 0.64;
            const downH = Math.max(0, yHour(0) - yHour(Math.max(0, d.downstairsHeatH)));
            const upH = Math.max(0, yHour(0) - yHour(Math.max(0, d.upstairsHeatH + d.downstairsHeatH)) - downH);
            const base = yHour(0);
            const hddH = d.hdd65 == null ? 0 : Math.max(0, yHdd(0) - yHdd(Math.max(0, d.hdd65)));
            return (
              <g key={d.date} onPointerEnter={() => setHover(i)}>
                <rect x={x} y={base - downH} width={bw} height={downH} fill="#7aa2ff" opacity={hover == null || hover === i ? 0.95 : 0.45} />
                <rect x={x} y={base - downH - upH} width={bw} height={upH} fill="#e8a04a" opacity={hover == null || hover === i ? 0.95 : 0.45} />
                {d.hdd65 != null && hddH > 0 && (
                  <rect x={x} y={yHdd(0) - hddH} width={bw} height={hddH} fill="#8fd0c6" opacity="0.85" />
                )}
              </g>
            );
          })}
          <path d={costPath} fill="none" stroke="#f8f3ff" strokeWidth="1.7" />
          <text x={0} y={20} fill="rgba(255,255,255,0.45)" fontSize="10">{maxHours.toFixed(0)}h</text>
          <text x={W - 32} y={20} fill="rgba(255,255,255,0.45)" fontSize="10">${Math.round(maxCost)}</text>
          <text x={0} y={212} fill="rgba(255,255,255,0.45)" fontSize="10">HDD</text>
          <text x={padL} y={top + 12} fill="rgba(255,255,255,0.45)" fontSize="10">{formatShortDate(shown[0].date)}</text>
          <text x={W - padR - 36} y={top + 12} fill="rgba(255,255,255,0.45)" fontSize="10">{formatShortDate(shown[shown.length - 1].date)}</text>
        </svg>
      </div>
      <p className="mt-1 text-xs text-white/70">
        {formatShortDate(active.date)} · Up {active.upstairsHeatH.toFixed(1)} h · Down {active.downstairsHeatH.toFixed(1)} h ·{" "}
        {formatCostRange(active.costLow, active.costHigh)}
        {active.hdd65 != null ? ` · HDD ${active.hdd65.toFixed(1)}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#e8a04a]" /> Upstairs hours</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#7aa2ff]" /> Downstairs hours</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-[#f8f3ff]" /> Gas $</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#8fd0c6]" /> HDD</span>
      </div>
    </div>
  );
}

export function FanEffectChart({ points }: { points: FanEffectPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return <p className="text-sm text-white/50">Not enough readings in the last 24 hours to show the fan&apos;s effect.</p>;
  }
  const padL = 36;
  const padR = 28;
  const h = 248;
  const tempTop = 14;
  const tempBottom = 156;
  const gapTop = 178;
  const gapBottom = 232;
  const times = points.map((p) => Date.parse(p.t));
  const t0 = times[0];
  const t1 = times[times.length - 1] || t0 + 1;
  const temps = points.flatMap((p) => [p.kitchenF, p.loftF].filter((n): n is number => n != null));
  const tempMin = (temps.length ? Math.min(...temps) : 60) - 1.5;
  const tempMax = (temps.length ? Math.max(...temps) : 80) + 1.5;
  const tempSpan = tempMax - tempMin || 1;
  const gaps = points.map((p) => p.gapF).filter((n): n is number => n != null);
  const gapMinRaw = gaps.length ? Math.min(0, ...gaps) : -1;
  const gapMaxRaw = gaps.length ? Math.max(0, ...gaps) : 1;
  const gapPad = Math.max(0.4, (gapMaxRaw - gapMinRaw) * 0.15);
  const gapMin = gapMinRaw - gapPad;
  const gapMax = gapMaxRaw + gapPad;
  const gapSpan = gapMax - gapMin || 1;
  const x = (t: number) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
  const yTemp = (v: number) => tempTop + (1 - (v - tempMin) / tempSpan) * (tempBottom - tempTop);
  const yGap = (v: number) => gapTop + (1 - (v - gapMin) / gapSpan) * (gapBottom - gapTop);
  const bands: { x: number; w: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].fanOn !== true) continue;
    const left = x(times[i]);
    const right = x(times[i + 1]);
    bands.push({ x: left, w: Math.max(0.5, right - left) });
  }
  const path = (pick: (p: FanEffectPoint) => number | null, y: (v: number) => number) => {
    let d = "";
    let drawing = false;
    points.forEach((p, i) => {
      const v = pick(p);
      if (v == null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${x(times[i]).toFixed(1)},${y(v).toFixed(1)} `;
      drawing = true;
    });
    return d.trim();
  };
  const active = points[hover ?? points.length - 1];
  function move(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    times.forEach((t, i) => {
      const dist = Math.abs(x(t) - px);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    setHover(best);
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${h}`}
        className="h-[260px] w-full touch-pan-y"
        role="img"
        aria-label="Loft and kitchen temperature, and the loft minus kitchen gap, for the last 24 hours. Shaded bands mark when the loft fan was on."
        onPointerMove={(e) => move(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((step) => {
          const value = tempMin + tempSpan * step;
          const yy = yTemp(value);
          return (
            <g key={step}>
              <line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="rgba(255,255,255,0.08)" />
              <text x={0} y={yy + 3} fill="rgba(255,255,255,0.45)" fontSize="10">
                {Math.round(value)}°
              </text>
            </g>
          );
        })}
        {bands.map((rect, i) => (
          <rect key={i} x={rect.x} y={tempTop} width={rect.w} height={gapBottom - tempTop} fill="rgba(134,239,172,0.22)" />
        ))}
        <path d={path((p) => p.loftF, yTemp)} fill="none" stroke="#c4b5fd" strokeWidth="1.8" />
        <path d={path((p) => p.kitchenF, yTemp)} fill="none" stroke="#f8f3ff" strokeWidth="2" />
        <line x1={padL} x2={W - padR} y1={yGap(0)} y2={yGap(0)} stroke="rgba(255,255,255,0.28)" strokeDasharray="3 3" />
        <text x={W - padR + 4} y={yGap(0) + 3} fill="rgba(255,255,255,0.45)" fontSize="10">0</text>
        <path d={path((p) => p.gapF, yGap)} fill="none" stroke="#86efac" strokeWidth="1.7" />
        <text x={0} y={gapTop + 8} fill="rgba(134,239,172,0.8)" fontSize="10">gap</text>
        {hover != null && (
          <line x1={x(times[hover])} x2={x(times[hover])} y1={tempTop} y2={gapBottom} stroke="rgba(255,255,255,0.45)" />
        )}
      </svg>
      <p className="mt-1 text-xs text-white/70">
        {formatChicagoTime(active.t)} · Kitchen {formatTemp(active.kitchenF)} · Loft {formatTemp(active.loftF)} · Gap {formatGap(active.gapF)}
        {active.fanOn == null ? "" : active.fanOn ? " · Fan on" : " · Fan off"}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#f8f3ff]" /> Kitchen</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#c4b5fd]" /> Loft</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-[#86efac]" /> Loft − kitchen</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#86efac]/40" /> Fan on</span>
      </div>
    </div>
  );
}

export function FanDailyChart({ days }: { days: FanDayPoint[] }) {
  const shown = days.slice(-14);
  const [hover, setHover] = useState<number | null>(null);
  if (!shown.length) return <p className="text-sm text-white/50">No daily fan readings yet.</p>;
  const padL = 32;
  const padR = 8;
  const h = 168;
  const inner = W - padL - padR;
  const slot = inner / shown.length;
  const maxHours = Math.max(1, ...shown.map((d) => d.runtimeH));
  const y = (v: number) => 16 + (1 - v / (maxHours * 1.15)) * 112;
  const active = shown[hover ?? shown.length - 1];
  const cost = active.cost == null ? "—" : formatUsd(active.cost);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${h}`} className="h-[170px] w-full touch-pan-y" role="img" aria-label="Loft fan runtime hours for recent days.">
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.12)" />
        <text x={0} y={24} fill="rgba(255,255,255,0.45)" fontSize="10">{maxHours < 1 ? `${Math.round(maxHours * 60)}m` : `${maxHours.toFixed(0)}h`}</text>
        {shown.map((d, i) => {
          const bx = padL + slot * i + slot * 0.18;
          const bw = slot * 0.64;
          const height = Math.max(0, y(0) - y(Math.max(0, d.runtimeH)));
          return (
            <g key={d.date} onPointerEnter={() => setHover(i)}>
              <rect x={bx} y={y(0) - height} width={bw} height={height} fill="#86efac" opacity={hover == null || hover === i ? 0.95 : 0.4} />
            </g>
          );
        })}
        <text x={padL} y={162} fill="rgba(255,255,255,0.45)" fontSize="10">{formatShortDate(shown[0].date)}</text>
        <text x={W - padR - 36} y={162} fill="rgba(255,255,255,0.45)" fontSize="10">{formatShortDate(shown[shown.length - 1].date)}</text>
      </svg>
      <p className="mt-1 text-xs text-white/70">
        {formatShortDate(active.date)} · {formatRuntime(active.runtimeH)} · {active.cycles} on-cycle{active.cycles === 1 ? "" : "s"} · {formatKwh(active.kwh)} · {cost}
      </p>
    </div>
  );
}

export function CcfChart({ days, baseline }: { days: HeatDayPoint[]; baseline: number }) {
  const shown = days.filter((d) => d.ccfPerHdd != null).slice(-30);
  if (!shown.length) return <p className="text-sm text-white/50">No degree-day rows yet.</p>;
  const padL = 36;
  const padR = 8;
  const h = 140;
  const inner = W - padL - padR;
  const slot = inner / shown.length;
  const max = Math.max(baseline * 1.4, ...shown.map((d) => d.ccfPerHdd ?? 0)) * 1.1;
  const y = (v: number) => 12 + (1 - v / max) * (h - 32);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="h-[150px] w-full" role="img" aria-label={`CCF per heating degree-day compared with a ${baseline} baseline.`}>
      <line x1={padL} x2={W - padR} y1={y(baseline)} y2={y(baseline)} stroke="#f0c14a" strokeDasharray="4 3" />
      <text x={0} y={y(baseline) + 3} fill="#f0c14a" fontSize="10">{baseline.toFixed(2)}</text>
      {shown.map((d, i) => {
        const value = d.ccfPerHdd ?? 0;
        const x = padL + slot * i + slot * 0.2;
        const bw = slot * 0.6;
        const top = y(value);
        return <rect key={d.date} x={x} y={top} width={bw} height={Math.max(0, y(0) - top)} fill={value <= baseline ? "#86efac" : "#fb923c"} />;
      })}
    </svg>
  );
}
