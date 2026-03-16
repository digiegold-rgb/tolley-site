"use client";

import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useApi<T>(url: string, refreshInterval = 60000): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refresh: fetchData };
}

export interface SnapshotHistoryPoint {
  date: string;
  nationalHealth: number | null;
  localKcHealth: number | null;
  mortgage30yr: number | null;
  mortgage15yr: number | null;
  treasury10yr: number | null;
  treasury30yr: number | null;
  unemployment: number | null;
  cpi: number | null;
  consumerSentiment: number | null;
  housingStarts: number | null;
  momentum: number | null;
  healthDelta: number | null;
  kcHealthDelta: number | null;
  sentimentBullPct: number | null;
  sentimentBearPct: number | null;
  articleCount: number;
  tickers: Record<string, { price: number; change: number; changePercent: number }> | null;
  dataPointCount: number;
  signalCount: number;
}

export function useSnapshotHistory(days: number) {
  return useApi<{ snapshots: SnapshotHistoryPoint[] }>(
    `/api/markets/snapshot/history?days=${days}`,
    120000 // 2 min refresh
  );
}

export interface SentimentPoint {
  date: string;
  total: number;
  bullish: number;
  neutral: number;
  bearish: number;
  avgSentiment: number;
}

export function useSentimentHistory(scope: string, days: number) {
  return useApi<{ sentiment: SentimentPoint[] }>(
    `/api/markets/sentiment/history?scope=${scope}&days=${days}`,
    120000
  );
}

export interface ArchivedSignal {
  id: string;
  originalSignalId: string;
  signal: string;
  confidence: number;
  scope: string;
  category: string;
  title: string;
  reasoning: string;
  timeHorizon: string | null;
  wasAccurate: boolean | null;
  createdAt: string;
  archivedAt: string;
}

export function useSignalHistory(days: number) {
  return useApi<{ signals: ArchivedSignal[] }>(
    `/api/markets/signals/history?days=${days}`,
    120000
  );
}

export interface DailyDigest {
  id: string;
  date: string;
  headline: string;
  keyChanges: { metric: string; from: number; to: number; direction: string }[];
  topArticles: { id: string; title: string; impactScore: number }[];
  riskFactors: { factor: string; severity: string; description: string }[];
  opportunities: { opportunity: string; confidence: number; reasoning: string }[];
  createdAt: string;
}

export function useDigest() {
  return useApi<{ digest: DailyDigest | null }>(
    "/api/markets/digest",
    300000 // 5 min
  );
}

export interface TopMover {
  id: string;
  type: string;
  title: string;
  numericValue: number | null;
  changePercent: number | null;
  impactScore: number | null;
  signal: string | null;
  tags: string[];
  createdAt: string;
}

export function useTopMovers(limit = 10) {
  return useApi<{ movers: TopMover[] }>(
    `/api/markets/top-movers?limit=${limit}`,
    120000
  );
}
