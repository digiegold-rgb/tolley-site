import React from "react";
import { RENTAL_CONTACT_PHONE } from "@/lib/rental";

export function RentalHero() {
  return (
    <section className="rent-hero-bg relative overflow-hidden pb-16 sm:pb-20">
      {/* Decorative floating orbs */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="rent-orb absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-teal-500 blur-[100px]" style={{"--orb-opacity":"0.06","--orb-dur":"9s","--orb-delay":"0s"} as React.CSSProperties} />
        <div className="rent-orb absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-teal-400 blur-[80px]" style={{"--orb-opacity":"0.05","--orb-dur":"11s","--orb-delay":"3s"} as React.CSSProperties} />
        <div className="rent-orb absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 blur-[60px]" style={{"--orb-opacity":"0.04","--orb-dur":"7s","--orb-delay":"1.5s"} as React.CSSProperties} />
        <div className="rent-orb absolute top-10 right-10 h-32 w-32 rounded-full bg-teal-300 blur-[60px]" style={{"--orb-opacity":"0.04","--orb-dur":"13s","--orb-delay":"5s"} as React.CSSProperties} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-teal-400/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="rent-neon-text mt-5 text-5xl font-black tracking-tight text-teal-400 uppercase sm:text-6xl lg:text-7xl">
          Need It for a Day?
          <br />
          <span className="text-white">We Rent It.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-slate-300">
          Games, tables, generators, trailers, moving supplies, and washers &amp; dryers —
          available by the day in the Kansas City area. Call to reserve, delivery available.
        </p>

        <div className="rent-badge-wrap mt-6 text-xs font-bold tracking-widest uppercase">
          <div className="rent-badge-track">
            {["Kansas City Area","Delivery Available","Call to Reserve","Daily Rentals","Games & Events","Trailers & Movers","Washers & Dryers","Generators","Kansas City Area","Delivery Available","Call to Reserve","Daily Rentals","Games & Events","Trailers & Movers","Washers & Dryers","Generators"].map((label, i) => (
              <span key={i} className="shrink-0 rounded border border-teal-400/25 bg-teal-400/[0.08] px-3 py-1.5 text-teal-300">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <a
            href={`tel:${RENTAL_CONTACT_PHONE}`}
            data-track-event="phone_click"
            data-track-label="rental_hero"
            className="rent-cta-glow inline-flex items-center gap-3 rounded-lg bg-teal-500 px-8 py-3.5 text-lg font-black tracking-wide text-white uppercase transition-all hover:-translate-y-0.5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call to Book
          </a>
        </div>
      </div>

      {/* Bottom edge — angular cut */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="block h-[40px] w-full sm:h-[60px]"
          fill="#0e0e14"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(20,184,166,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
