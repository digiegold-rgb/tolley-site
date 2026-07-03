"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function HpHero() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
      el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
    };
    el.addEventListener("mousemove", handler);
    return () => el.removeEventListener("mousemove", handler);
  }, []);

  return (
    <section
      ref={gridRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pt-24 pb-16 sm:px-8"
    >
      {/* AI-generated hero video background.
          Source: Wan 2.2 14B T2V via ComfyUI on DGX Spark
          (aerial neighborhood at blue hour, pingpong loop). */}
      <video
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/heroes/homepage-still.png"
      >
        <source src="/heroes/homepage-loop.mp4" type="video/mp4" />
      </video>

      {/* Film grain overlay */}
      <div
        aria-hidden="true"
        className="hp-hero-grain pointer-events-none absolute inset-0 z-[1]"
      />

      {/* Drifting light-leak */}
      <div
        aria-hidden="true"
        className="hp-hero-light-leak pointer-events-none absolute inset-0 z-[1]"
      />

      {/* Dark gradient overlay so the headline stays readable over the image. */}
      <div
        aria-hidden="true"
        className="hp-hero-bg-overlay absolute inset-0 z-[1]"
      />

      {/* Vignette */}
      <div
        aria-hidden="true"
        className="hp-hero-vignette pointer-events-none absolute inset-0 z-[1]"
      />

      {/* Mouse-follow glow — sits above the hero image + overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            "radial-gradient(600px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(139,92,246,0.1), transparent 60%)",
        }}
      />

      {/* Decorative spotlights */}
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="hp-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/18 bg-black/25 px-4 py-1.5 backdrop-blur-sm">
          <span className="progress-orb !h-2 !w-2" />
          <span className="text-[0.68rem] tracking-[0.14em] text-white/68 uppercase">
            AI-Powered Lead Intelligence
          </span>
        </div>

        {/* Headline */}
        <h1 className="hp-fade-up hp-fade-up-d1 text-4xl font-semibold leading-[1.15] tracking-[0.01em] text-white/95 sm:text-5xl md:text-6xl">
          Know your leads before
          <br />
          <span className="hp-gradient-text">
            they know you&apos;re coming.
          </span>
        </h1>

        {/* Sub-copy */}
        <p className="hp-fade-up hp-fade-up-d2 mx-auto mt-6 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
          T-Agent enriches every lead with court records, social profiles, and
          AI-scored motivation — giving real estate agents the unfair advantage
          they need to close.
        </p>

        {/* CTAs */}
        <div className="hp-fade-up hp-fade-up-d3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/leads/pricing"
            className="group relative rounded-full border border-violet-200/45 bg-violet-300/20 px-8 py-3 text-sm font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_32px_rgba(139,92,246,0.25)] transition-all hover:bg-violet-300/28 hover:shadow-[0_0_48px_rgba(139,92,246,0.45)] hover:scale-[1.02]"
          >
            <span className="relative z-10">See Plans — From $49/mo</span>
          </Link>
          <Link
            href="#features"
            className="rounded-full border border-white/22 bg-white/[0.07] px-8 py-3 text-sm font-semibold tracking-[0.1em] text-white uppercase transition-all hover:bg-white/[0.12] hover:border-white/30"
          >
            See How It Works
          </Link>
        </div>

        {/* Trusted by line */}
        <p className="hp-fade-up hp-fade-up-d4 mt-8 text-[0.65rem] tracking-[0.12em] text-white/38 uppercase">
          Trusted by agents in Kansas City, Dallas &amp; beyond
        </p>
      </div>
    </section>
  );
}
