"use client";

import { useEffect, useState } from "react";
import { CRAZY } from "@/app/crazybins/data";

export function CrazyDailyLadder() {
  const [today, setToday] = useState<number | null>(null);

  useEffect(() => {
    setToday(new Date().getDay());
  }, []);

  return (
    <section id="daily-deals" className="relative bg-[#fff7ec] px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="crazy-enter text-center">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#e63946]">Daily Deals · Ofertas Diarias</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#1d2d50] sm:text-5xl lg:text-6xl">
            Every Day Is a <span className="text-[#ff6b1a]">New Deal.</span>
          </h2>
          <p className="mt-3 text-base italic text-[#5b6b85]">Cada día un trato nuevo · ¡no te lo pierdas!</p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 lg:gap-4">
          {CRAZY.dailyLadder.map((d, i) => {
            const isToday = today === i;
            const isClosed = d.price === null;
            return (
              <div
                key={d.day}
                className={`crazy-tile crazy-enter relative flex flex-col items-center justify-center rounded-2xl border-2 p-4 text-center sm:p-6 ${
                  isToday
                    ? isClosed
                      ? "z-10 scale-105 border-[#1d2d50] bg-[#1d2d50] text-white shadow-2xl"
                      : "crazy-pulse z-10 scale-105 border-[#e63946] bg-gradient-to-br from-[#ffd60a] via-[#ff6b1a] to-[#e63946] text-white shadow-2xl"
                    : isClosed
                      ? "border-[#1d2d50] bg-[#1d2d50] text-white"
                      : "border-orange-200 bg-white text-[#1d2d50]"
                }`}
                style={{ "--enter-delay": `${i * 0.05}s` } as React.CSSProperties}
              >
                {isToday && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#e63946] shadow">
                    Today · Hoy
                  </span>
                )}
                <span className={`text-xs font-black uppercase tracking-widest ${isToday ? "text-white/90" : isClosed ? "text-yellow-300" : "text-[#e63946]"}`}>
                  {CRAZY.hours.days[i].en}
                </span>
                <span className={`mt-2 font-black ${isClosed ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl"}`} style={{ fontFeatureSettings: '"tnum"' }}>
                  {isClosed ? "🚫 CLOSED" : `$${d.price}`}
                </span>
                <span className={`mt-2 text-[11px] font-semibold leading-tight ${isToday ? "text-white/95" : isClosed ? "text-yellow-200" : "text-[#5b6b85]"}`}>
                  {d.blurb}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm font-semibold text-[#5b6b85]">
          📍 <strong className="text-[#1d2d50]">{CRAZY.location.fullAddress}</strong> · Open 10AM – 6:30PM ·{" "}
          <span className="text-[#e63946]">Closed Thursdays for restock</span>
        </p>
      </div>
    </section>
  );
}
