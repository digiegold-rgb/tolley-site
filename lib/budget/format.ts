export const CENTS = 100;

export function dollarsToCents(value: number | string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * CENTS);
}

export function centsToDollars(cents: number): number {
  return cents / CENTS;
}

export function formatMoney(cents: number, opts?: { signed?: boolean }): string {
  const dollars = Math.abs(cents) / CENTS;
  const formatted = dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  if (opts?.signed && cents > 0) return `+${formatted}`;
  if (cents < 0) return `-${formatted}`;
  return formatted;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export type Period = "today" | "week" | "month" | "year" | "all";

export function periodWindow(period: Period, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  switch (period) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "week": {
      const day = from.getDay();
      const diff = (day + 6) % 7;
      from.setDate(from.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case "year":
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case "all":
      from.setFullYear(2000, 0, 1);
      break;
  }
  return { from, to };
}

export function spokenAmount(cents: number): string {
  const dollars = Math.abs(cents) / CENTS;
  if (dollars % 1 === 0) return `$${dollars.toFixed(0)}`;
  return `$${dollars.toFixed(2)}`;
}
