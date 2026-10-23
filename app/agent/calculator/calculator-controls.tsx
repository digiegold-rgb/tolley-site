"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import styles from "./mortgage-calculator.module.css";

const roundedCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const money = (n: number) => roundedCurrency.format(n);
const centsCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const exactMoney = (n: number) => centsCurrency.format(n);

export function Icon({ name }: { name: "home" | "sun" | "moon" | "share" | "arrow" }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "home" ? <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></> : name === "sun" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : name === "moon" ? <path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z" /> : name === "share" ? <><path d="M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9" /></> : <path d="M5 12h14m-5-5 5 5-5 5" />}
  </svg>;
}

export function NumberField({ id, label, value, onChange, min = 0, max, suffix, prefix, large = false }: {
  id: string; label: string; value: number; onChange: (n: number) => void; min?: number; max: number; suffix?: string; prefix?: string; large?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className={`${styles.field} ${large ? styles.largeField : ""}`} htmlFor={id}>
    <span>{label}</span>
    <span className={styles.inputWrap}>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <input id={id} type="text" inputMode={min < 0 ? "text" : "decimal"} autoComplete="off" value={draft ?? (prefix === "$" ? Number(value.toFixed(2)).toLocaleString("en-US") : String(Number(value.toFixed(4))))}
        onChange={e => {
          const next = e.target.value.replace(/[$,%\s]/g, "");
          if (!(min < 0 ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/).test(next)) return;
          setDraft(next);
          const n = Number(next);
          if (next && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          if (draft !== null && draft !== "" && Number.isFinite(Number(draft))) onChange(Math.min(max, Math.max(min, Number(draft))));
          setDraft(null);
        }} />
      {suffix && <span>{suffix}</span>}
    </span>
  </label>;
}

export function Slider({ id, label, value, min, max, step, onChange, format }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; format: (n: number) => string }) {
  return <div className={styles.sliderWrap}>
    <input id={id} aria-label={label} aria-valuetext={format(value)} type="range" disabled={max <= min} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ "--fill": `${max > min ? (value - min) / (max - min) * 100 : 0}%` } as CSSProperties} />
    <div className={styles.rangeEnds}><span>{format(min)}</span><span>{format(max)}</span></div>
  </div>;
}

export function Row({ label, value, dot, strong = false }: { label: ReactNode; value: string; dot?: string; strong?: boolean }) {
  return <div className={`${styles.row} ${strong ? styles.strongRow : ""}`}><dt>{dot && <i style={{ background: dot }} />}{label}</dt><dd>{value}</dd></div>;
}

