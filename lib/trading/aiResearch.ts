import { prisma } from "@/lib/prisma";
import type { TradingAgentDecision } from "@prisma/client";

export const TIER1_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "META",
  "NVDA", "TSLA", "JPM", "V", "UNH",
] as const;

export type Tier1Ticker = (typeof TIER1_TICKERS)[number];

export type ResearchVerdict = {
  ticker: string;
  decision: "BUY" | "SELL" | "HOLD";
  rawDecision: string | null;
  runDate: string;
  createdAt: string;
  daysOld: number;
  alphaVsSpy: number | null;
  realizedReturn: number | null;
};

function classifyDecision(raw: string | null | undefined): "BUY" | "SELL" | "HOLD" {
  if (!raw) return "HOLD";
  const upper = raw.trim().toUpperCase();
  if (upper === "BUY" || upper === "SELL" || upper === "HOLD") return upper;
  if (/\b(BUY|OVERWEIGHT|ACCUMULATE|LONG|BULLISH)\b/.test(upper)) return "BUY";
  if (/\b(SELL|UNDERWEIGHT|REDUCE|SHORT|BEARISH)\b/.test(upper)) return "SELL";
  return "HOLD";
}

function daysBetween(runDate: string, now: Date = new Date()): number {
  const d = new Date(runDate);
  if (Number.isNaN(d.getTime())) return 999;
  const ms = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / (24 * 3600 * 1000)));
}

function toVerdict(row: TradingAgentDecision): ResearchVerdict {
  const decision = classifyDecision(row.decision || row.rawDecision);
  return {
    ticker: row.ticker,
    decision,
    rawDecision: row.rawDecision ?? row.decision ?? null,
    runDate: row.runDate,
    createdAt: row.createdAt.toISOString(),
    daysOld: daysBetween(row.runDate),
    alphaVsSpy: row.alphaVsSpy ?? null,
    realizedReturn: row.realizedReturn ?? null,
  };
}

export async function getLatestVerdicts(
  tickers: readonly string[] = TIER1_TICKERS,
): Promise<ResearchVerdict[]> {
  const rows = await Promise.all(
    tickers.map((ticker) =>
      prisma.tradingAgentDecision.findFirst({
        where: { ticker },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );
  return rows.filter((r): r is TradingAgentDecision => r !== null).map(toVerdict);
}

export type ConsensusSummary = {
  buy: number;
  sell: number;
  hold: number;
  total: number;
  dominant: "BUY" | "SELL" | "HOLD" | "MIXED";
  freshTickers: number;
};

export function summarizeConsensus(verdicts: ResearchVerdict[]): ConsensusSummary {
  let buy = 0, sell = 0, hold = 0, freshTickers = 0;
  for (const v of verdicts) {
    if (v.decision === "BUY") buy++;
    else if (v.decision === "SELL") sell++;
    else hold++;
    if (v.daysOld <= 3) freshTickers++;
  }
  const total = verdicts.length;
  let dominant: ConsensusSummary["dominant"] = "MIXED";
  const max = Math.max(buy, sell, hold);
  const tied = [buy, sell, hold].filter((n) => n === max).length;
  if (tied === 1 && total > 0) {
    dominant = max === buy ? "BUY" : max === sell ? "SELL" : "HOLD";
  }
  return { buy, sell, hold, total, dominant, freshTickers };
}
