"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * The Circle flywheel — 8 group nodes orbiting the HQ hub, each carrying its
 * REAL last-30-day traffic and lead counts. Click a node to open that group's
 * live products below the wheel. Pure client presentation; all data arrives
 * as props from the server page so the registry stays the source of truth.
 */

export interface FlywheelProduct {
  name: string;
  url: string;
  title: string;
  tagline: string;
  emoji: string;
}

export interface FlywheelGroup {
  group: string;
  emoji: string;
  color: string; // hex accent
  visits30d: number;
  leads30d: number;
  entries: FlywheelProduct[];
}

function fmt(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function CircleFlywheel({
  groups,
  totalVisits,
  totalLeads,
}: {
  groups: FlywheelGroup[];
  totalVisits: number;
  totalLeads: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = groups.find((g) => g.group === selected) ?? null;

  const SIZE = 640;
  const C = SIZE / 2;
  const R = 235; // node orbit radius
  const NODE_R = 52;

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full max-w-[640px]">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="The Tolley Circle — every service orbiting one hub"
        >
          {/* Decorative rotating orbit ring */}
          <g className="circle-orbit" style={{ transformOrigin: `${C}px ${C}px` }}>
            <circle
              cx={C}
              cy={C}
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1.5"
              strokeDasharray="6 10"
            />
            {/* Flow arrows showing the loop direction */}
            {[45, 135, 225, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x = C + R * Math.cos(rad);
              const y = C + R * Math.sin(rad);
              return (
                <g key={deg} transform={`translate(${x} ${y}) rotate(${deg + 90})`}>
                  <path d="M -5 4 L 0 -5 L 5 4" fill="none" stroke="rgba(168,85,247,0.55)" strokeWidth="2" strokeLinecap="round" />
                </g>
              );
            })}
          </g>

          {/* Spokes */}
          {groups.map((g, i) => {
            const rad = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
            const x = C + R * Math.cos(rad);
            const y = C + R * Math.sin(rad);
            return (
              <line
                key={g.group}
                x1={C}
                y1={C}
                x2={x}
                y2={y}
                stroke={selected === g.group ? g.color : "rgba(255,255,255,0.07)"}
                strokeWidth={selected === g.group ? 1.5 : 1}
              />
            );
          })}

          {/* Hub */}
          <circle cx={C} cy={C} r={86} fill="rgba(12,10,20,0.95)" stroke="rgba(168,85,247,0.5)" strokeWidth="2" />
          <circle cx={C} cy={C} r={96} fill="none" stroke="rgba(168,85,247,0.18)" strokeWidth="1" />
          <text x={C} y={C - 26} textAnchor="middle" fill="#f8f3ff" fontSize="15" fontWeight="800">
            TOLLEY HQ
          </text>
          <text x={C} y={C - 8} textAnchor="middle" fill="#a3a3a3" fontSize="10">
            every lead, one inbox
          </text>
          <text x={C} y={C + 18} textAnchor="middle" fill="#f8f3ff" fontSize="17" fontWeight="800">
            {fmt(totalVisits)} visits
          </text>
          <text x={C} y={C + 38} textAnchor="middle" fill="#c4b5fd" fontSize="13" fontWeight="700">
            {fmt(totalLeads)} leads · 30 days
          </text>

          {/* Group nodes */}
          {groups.map((g, i) => {
            const rad = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
            const x = C + R * Math.cos(rad);
            const y = C + R * Math.sin(rad);
            const isSel = selected === g.group;
            return (
              <g
                key={g.group}
                onClick={() => setSelected(isSel ? null : g.group)}
                className="cursor-pointer"
                role="button"
                aria-label={`${g.group}: ${g.visits30d} visits, ${g.leads30d} leads in 30 days`}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={NODE_R}
                  fill={isSel ? `${g.color}33` : "rgba(15,13,22,0.92)"}
                  stroke={g.color}
                  strokeWidth={isSel ? 2.5 : 1.5}
                />
                <text x={x} y={y - 22} textAnchor="middle" fontSize="20">
                  {g.emoji}
                </text>
                <text x={x} y={y - 2} textAnchor="middle" fill="#f8f3ff" fontSize="10.5" fontWeight="700">
                  {g.group.length > 14 ? (
                    <>
                      <tspan x={x} dy="0">{g.group.split(" & ")[0]}{g.group.includes(" & ") ? " &" : ""}</tspan>
                      <tspan x={x} dy="11">{g.group.includes(" & ") ? g.group.split(" & ")[1] : ""}</tspan>
                    </>
                  ) : (
                    g.group
                  )}
                </text>
                <text x={x} y={y + 24} textAnchor="middle" fill="#d4d4d4" fontSize="10" fontWeight="600">
                  {fmt(g.visits30d)} visits
                </text>
                <text x={x} y={y + 36} textAnchor="middle" fill={g.color} fontSize="10" fontWeight="700">
                  {fmt(g.leads30d)} leads
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected group → live products */}
      {active && (
        <div className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white">
              {active.emoji} {active.group} — live now
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-neutral-500 transition hover:text-white"
            >
              close ✕
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {active.entries.map((p) => (
              <Link
                key={p.name}
                href={`${p.url}?ref=circle`}
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 transition hover:border-white/30"
              >
                <span className="text-xl" aria-hidden="true">{p.emoji}</span>
                <span>
                  <span className="block text-sm font-bold text-white group-hover:underline">{p.title}</span>
                  <span className="block text-xs text-neutral-400">{p.tagline}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {!active && (
        <p className="mt-4 text-center text-xs text-neutral-500">
          Tap any circle to see what&apos;s live inside it — real numbers, last 30 days.
        </p>
      )}
    </div>
  );
}
