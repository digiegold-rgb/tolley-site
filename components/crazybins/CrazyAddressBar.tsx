"use client";

import { useEffect, useState } from "react";
import { CRAZY } from "@/app/crazybins/data";

export function CrazyAddressBar() {
  const [isClosed, setIsClosed] = useState(false);
  useEffect(() => {
    setIsClosed(new Date().getDay() === CRAZY.hours.closedDay);
  }, []);

  return (
    <div className="crazy-sticky-bar lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-black uppercase tracking-widest text-[#ffd60a]">📍 4452 S Noland Rd</div>
          <div className="truncate text-xs font-semibold text-white/85">
            {isClosed ? "🚫 Closed today · back Friday" : "Open today · 10AM – 6:30PM"}
          </div>
        </div>
        <a
          href={CRAZY.location.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-full bg-[#ff6b1a] px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md"
        >
          Directions
        </a>
        <a
          href={CRAZY.brand.messengerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-[#1d2d50] shadow-md"
          aria-label="Message us on Facebook"
        >
          💬
        </a>
      </div>
    </div>
  );
}
