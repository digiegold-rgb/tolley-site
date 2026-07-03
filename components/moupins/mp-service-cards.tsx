"use client";

import { useCallback, useRef } from "react";

type Service = {
  readonly title: string;
  readonly emoji: string;
  readonly description: string;
  readonly items: readonly string[];
};

function ServiceCard({ svc }: { svc: Service }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="mp-glow-card group rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(22,163,74,0.05),rgba(255,255,255,0.02)),rgba(8,12,5,0.5)] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-green-500/20"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-green-500/15 bg-green-500/[0.06] text-lg transition-colors group-hover:border-green-500/25">
          {svc.emoji}
        </div>
        <h3 className="text-base font-bold text-white/90">{svc.title}</h3>
      </div>
      <p className="text-sm leading-6 text-white/50">{svc.description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {svc.items.map((item) => (
          <span key={item} className="mp-tag rounded-full px-2.5 py-0.5 text-[0.65rem] text-green-400/70">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MpServiceCards({ services }: { services: readonly Service[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {services.map((svc) => (
        <ServiceCard key={svc.title} svc={svc} />
      ))}
    </div>
  );
}
