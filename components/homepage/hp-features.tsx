"use client";

import { useCallback, useRef } from "react";

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Lead Dossiers",
    description:
      "Auto-generated intelligence reports pulling court records, social profiles, property history, and public data into one view.",
    span: "lg:col-span-2",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "SMS Sequences",
    description:
      "Twilio-powered drip campaigns with smart timing, personalization, and compliance-first A2P messaging built in.",
    span: "",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    title: "Motivation Scoring",
    description:
      "AI analyzes dozens of signals — liens, life events, ownership duration — to rank how likely a lead is to transact.",
    span: "",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: "Market Intelligence",
    description:
      "Real-time market data, comp analysis, and neighborhood trends to back every conversation with hard numbers.",
    span: "",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    title: "CRM & Workflows",
    description:
      "Pipeline management with automated follow-ups, task routing, and stage-based triggers — no manual busywork.",
    span: "",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Court Record Search",
    description:
      "Nationwide court record lookups — civil, criminal, bankruptcy, liens — surfaced automatically in every dossier.",
    span: "lg:col-span-2",
  },
];

function FeatureCard({
  feature,
}: {
  feature: (typeof features)[number];
}) {
  const cardRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`hp-glow-card group rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(129,75,229,0.09)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/28 hover:shadow-[0_22px_52px_rgba(3,2,10,0.68)] ${feature.span}`}
    >
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-violet-200/80 transition-colors group-hover:border-violet-300/30 group-hover:text-violet-200">
        {feature.icon}
      </div>
      <h3 className="text-base font-semibold text-white/95">{feature.title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/68">{feature.description}</p>
    </article>
  );
}

export function HpFeatures() {
  return (
    <section id="features" className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8">
      <div className="mb-10 text-center">
        <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
          Platform
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[0.02em] text-white/95 sm:text-4xl">
          Everything you need to close
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/72">
          Six core capabilities that turn raw leads into actionable intelligence.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </div>
    </section>
  );
}
