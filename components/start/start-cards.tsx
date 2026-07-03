"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef } from "react";

type Service = {
  readonly href: string;
  readonly label: string;
  readonly desc: string;
  readonly color: string;
  readonly image: string;
};

function ServiceCard({ svc, delay }: { svc: Service; delay: number }) {
  const cardRef = useRef<HTMLAnchorElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    el.style.setProperty("--card-color", svc.color);
  }, [svc.color]);

  return (
    <Link
      ref={cardRef}
      href={svc.href}
      onMouseMove={handleMouseMove}
      className="group relative flex gap-4 overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),rgba(8,7,15,0.5)] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/22"
      style={{
        animationDelay: `${delay}ms`,
        boxShadow: `0 12px 32px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Mouse-follow glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(250px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${svc.color}15, transparent 70%)`,
        }}
      />

      {/* Top accent line */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${svc.color}60, transparent)`,
        }}
      />

      {/* Image */}
      <div
        className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border shadow-lg transition-transform duration-300 group-hover:scale-105"
        style={{ borderColor: `${svc.color}30` }}
      >
        <Image
          src={svc.image}
          alt={svc.label}
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>

      {/* Text */}
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white/90 transition-colors group-hover:text-white">
            {svc.label}
          </p>
          <svg
            className="h-3.5 w-3.5 -translate-x-1 text-white/0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-white/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="mt-1 text-xs leading-5 text-white/45 transition-colors group-hover:text-white/55">
          {svc.desc}
        </p>
      </div>

      {/* Color dot */}
      <div
        className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full opacity-40 transition-opacity group-hover:opacity-80"
        style={{ backgroundColor: svc.color }}
      />
    </Link>
  );
}

export function StartCards({
  services,
  sectionIdx,
}: {
  services: readonly Service[];
  sectionIdx: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((svc, i) => (
        <ServiceCard
          key={svc.href}
          svc={svc}
          delay={sectionIdx * 50 + i * 80}
        />
      ))}
    </div>
  );
}
