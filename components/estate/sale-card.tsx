"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface SaleCardData {
  slug: string;
  title: string;
  areaLabel: string;
  address: string | null; // null until publish time — server decides
  days: { date: string; open: string; close: string; note?: string }[];
  startsAtIso: string;
  addressPublishAtIso: string | null;
  highlights: string[];
  status: string;
}

function fmtDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function fmtHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${ampm}` : `${hr}${ampm}`;
}

function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1000),
  };
}

export default function SaleCard({ sale }: { sale: SaleCardData }) {
  const count = useCountdown(sale.startsAtIso);
  const live = sale.status === "live" || (!count && sale.status === "upcoming");

  return (
    <div className="es-sale-plate p-8 sm:p-10">
      <div className="relative z-10 text-center">
        <p className="es-kicker justify-center">
          {live ? "Happening now" : "This weekend"}
        </p>
        <h2 className="es-display mt-4 text-3xl font-semibold sm:text-4xl">
          {sale.title}
        </h2>

        <div className="mt-5 space-y-1">
          {sale.days.map((d) => (
            <p key={d.date} className="text-base sm:text-lg" style={{ color: "var(--es-cream-dim)" }}>
              <span className="font-semibold" style={{ color: "var(--es-cream)" }}>
                {fmtDay(d.date)}
              </span>{" "}
              · {fmtHour(d.open)}–{fmtHour(d.close)}
              {d.note ? (
                <span className="es-italic" style={{ color: "var(--es-brass-bright)" }}>
                  {" "}
                  — {d.note}
                </span>
              ) : null}
            </p>
          ))}
        </div>

        <p className="mt-4 text-sm" style={{ color: "var(--es-cream-dim)" }}>
          📍{" "}
          {sale.address ? (
            <span className="font-semibold" style={{ color: "var(--es-cream)" }}>
              {sale.address}
            </span>
          ) : (
            <>
              {sale.areaLabel} —{" "}
              <span className="es-italic">exact address released the day before the sale</span>
            </>
          )}
        </p>

        {count && (
          <div className="mx-auto mt-6 flex max-w-sm items-stretch justify-center gap-3">
            {[
              { v: count.days, l: "days" },
              { v: count.hours, l: "hrs" },
              { v: count.mins, l: "min" },
              { v: count.secs, l: "sec" },
            ].map((u) => (
              <div key={u.l} className="es-panel min-w-[4rem] px-3 py-2">
                <div className="es-count text-2xl sm:text-3xl">
                  {String(u.v).padStart(2, "0")}
                </div>
                <div
                  className="text-[0.6rem] uppercase tracking-widest"
                  style={{ color: "var(--es-cream-dim)" }}
                >
                  {u.l}
                </div>
              </div>
            ))}
          </div>
        )}

        {live && (
          <p className="es-display mt-6 text-xl" style={{ color: "var(--es-brass-bright)" }}>
            Doors are open — come find your treasure.
          </p>
        )}

        {sale.highlights.length > 0 && (
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed" style={{ color: "var(--es-cream-dim)" }}>
            {sale.highlights.join(" · ")}
          </p>
        )}

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`/estate/sales/${sale.slug}`}
            className="es-btn-primary px-7 py-3 text-sm"
          >
            Sale details &amp; photos
          </Link>
          <a href="#alerts" className="es-btn-secondary px-7 py-3 text-sm">
            Get the address first — join the list
          </a>
        </div>
      </div>
    </div>
  );
}
