"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 50, suffix: "+", label: "State Court Records" },
  { value: 0, text: "AI", label: "Motivation Scoring" },
  { value: 0, text: "MLS", label: "Integrated Data" },
  { value: 0, text: "24/7", label: "Automated Enrichment" },
];

function AnimatedValue({ value, suffix, text }: { value: number; suffix?: string; text?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || text) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1200;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, text]);

  if (text) {
    return <span>{text}</span>;
  }

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

export function HpSocialProof() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <div className="hp-fade-up rounded-2xl border border-white/12 bg-black/22 px-6 py-6 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="group text-center">
              <p className="text-2xl font-semibold tracking-[0.02em] text-white/95 transition-colors group-hover:text-violet-200 sm:text-3xl">
                <AnimatedValue value={stat.value} suffix={stat.suffix} text={stat.text} />
              </p>
              <p className="mt-1 text-[0.68rem] tracking-[0.12em] text-white/58 uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
