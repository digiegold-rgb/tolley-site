"use client";

import { useEffect, useState } from "react";
import { CRAZY } from "@/app/crazybins/data";

export function CrazyDealOfDay() {
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => {
    setDay(new Date().getDay());
  }, []);

  if (day === null) {
    // Avoid hydration mismatch — render a neutral placeholder server-side
    return (
      <div className="mt-7 inline-flex h-[88px] w-full max-w-md items-center rounded-2xl bg-white/15 px-6 backdrop-blur-sm ring-2 ring-white/20" aria-hidden="true" />
    );
  }

  const today = CRAZY.dailyLadder[day];
  const isClosed = today.price === null;
  const priceText = isClosed ? "🚫 Closed" : `$${today.price}`;
  const subText = isClosed ? "Back tomorrow" : today.label;

  return (
    <div className={`mt-7 inline-flex max-w-md items-center gap-4 rounded-2xl px-6 py-4 ring-4 ${isClosed ? "bg-[#1d2d50] ring-[#1d2d50]/40" : "crazy-pulse bg-white ring-white/40"}`}>
      <div className="flex flex-col">
        <span className={`text-xs font-black uppercase tracking-widest ${isClosed ? "text-[#ffd60a]" : "text-[#e63946]"}`}>
          {isClosed ? "Closed Today" : "Today"}
        </span>
        <span className={`text-sm font-bold ${isClosed ? "text-white" : "text-[#1d2d50]"}`}>{subText}</span>
      </div>
      <div className={`text-3xl font-black sm:text-5xl ${isClosed ? "text-[#ffd60a]" : "text-[#ff6b1a]"}`} style={{ fontFeatureSettings: '"tnum"' }}>
        {priceText}
      </div>
    </div>
  );
}
