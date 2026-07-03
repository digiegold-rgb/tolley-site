/**
 * Build short spoken-summary strings for Siri to read back.
 * Keep them under ~140 chars so Siri sounds natural.
 */
import { spokenAmount } from "./format";

export function spokenLogged(args: {
  amount: number;
  categoryName: string | null;
  tags: string[];
  remainingCents: number | null;
  remainingPeriod: string;
}): string {
  const cents = Math.round(args.amount * 100);
  const cat = args.categoryName ? `to ${args.categoryName}` : "uncategorized";
  const tagStr = args.tags.length > 0 ? `, tagged ${args.tags.join(" and ")}` : "";
  const rem =
    args.remainingCents !== null
      ? ` ${spokenAmount(args.remainingCents)} ${args.remainingCents < 0 ? "over" : "left"} ${args.remainingPeriod}.`
      : "";
  return `Logged ${spokenAmount(cents)} ${cat}${tagStr}.${rem}`.trim();
}

export function spokenRemaining(args: {
  categoryName: string;
  remainingCents: number;
  period: string;
}): string {
  if (args.remainingCents < 0) {
    return `You're ${spokenAmount(Math.abs(args.remainingCents))} over in ${args.categoryName} ${args.period}.`;
  }
  return `${spokenAmount(args.remainingCents)} left in ${args.categoryName} ${args.period}.`;
}

export function spokenSpent(args: {
  scope: string;
  spentCents: number;
  period: string;
}): string {
  return `You've spent ${spokenAmount(args.spentCents)} on ${args.scope} ${args.period}.`;
}

export function spokenRecent(items: Array<{ vendor: string | null; amount: number; categoryName: string | null }>): string {
  if (items.length === 0) return "No recent transactions.";
  const list = items
    .slice(0, 5)
    .map((t) => `${spokenAmount(Math.round(t.amount * 100))} at ${t.vendor || t.categoryName || "unknown"}`)
    .join(", ");
  return `Last ${items.length}: ${list}.`;
}

export function spokenTop(items: Array<{ name: string; spentCents: number }>): string {
  if (items.length === 0) return "No spending this period.";
  const list = items
    .slice(0, 5)
    .map((c) => `${c.name} ${spokenAmount(c.spentCents)}`)
    .join(", ");
  return `Top categories: ${list}.`;
}

export function periodPhrase(period: "today" | "week" | "month" | "year" | "all"): string {
  switch (period) {
    case "today": return "today";
    case "week": return "this week";
    case "month": return "this month";
    case "year": return "this year";
    case "all": return "all-time";
  }
}
