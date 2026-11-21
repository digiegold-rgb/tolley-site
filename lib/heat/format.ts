import { ZONE } from "./time";

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2,
    minimumFractionDigits: Math.abs(n) >= 100 ? 0 : 2,
  }).format(n);
}

export function formatCostRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return "—";
  const a = low ?? high!;
  const b = high ?? low!;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (Math.abs(hi - lo) < 0.05) return formatUsd(lo);
  return `${formatUsd(lo)}–${formatUsd(hi)}`;
}

export function formatHours(n: number): string {
  return `${n.toFixed(1)} h`;
}

export function formatRuntime(hours: number): string {
  if (hours < 1 / 60) return "0 min";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return formatHours(hours);
}

export function formatKwh(n: number | null): string {
  if (n == null) return "—";
  if (n === 0) return "0 kWh";
  return `${n.toFixed(n < 10 ? 3 : 1)} kWh`;
}

export function formatGap(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}°`;
}

/** `0.12495` → `12.495¢/kWh`. */
export function formatElectricRate(usdPerKwh: number): string {
  const text = (usdPerKwh * 100).toFixed(3).replace(/\.?0+$/, "");
  return `${text}¢/kWh`;
}

export function formatTemp(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}°`;
}

export function formatAge(sec: number): string {
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 48 * 3600) {
    const hours = Math.round(sec / 3600);
    return `${hours} hr ago`;
  }
  const days = Math.round(sec / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatChicagoTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function statusLabel(hvac: "heat" | "fan" | "off"): string {
  if (hvac === "heat") return "Heating";
  if (hvac === "fan") return "Fan";
  return "Idle";
}
