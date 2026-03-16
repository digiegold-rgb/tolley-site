/**
 * Comp analysis — fetch comparable sold listings from research worker.
 */

const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";

export interface CompResult {
  title: string;
  price: number;
  url: string | null;
  imageUrl: string | null;
  soldDate: string | null;
  condition: string | null;
}

export interface CompSummary {
  query: string;
  count: number;
  avgPrice: number;
  medianPrice: number;
  lowPrice: number;
  highPrice: number;
  items: CompResult[];
}

export async function fetchComps(query: string): Promise<CompSummary> {
  const res = await fetch(`${RESEARCH_WORKER_URL}/scrape/ebay-completed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": process.env.SYNC_SECRET || "",
    },
    body: JSON.stringify({ query, maxResults: 20 }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Research worker returned ${res.status}`);
  }

  const data = await res.json();
  const items: CompResult[] = (data.items || []).map((item: Record<string, unknown>) => ({
    title: item.title as string,
    price: (item.soldPrice || item.price) as number,
    url: (item.url as string) || null,
    imageUrl: (item.imageUrl as string) || null,
    soldDate: (item.soldDate as string) || null,
    condition: (item.condition as string) || null,
  }));

  const prices = items.map((i) => i.price).filter((p) => p > 0);
  const sorted = [...prices].sort((a, b) => a - b);

  return {
    query,
    count: items.length,
    avgPrice: prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : 0,
    medianPrice: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
    lowPrice: sorted[0] || 0,
    highPrice: sorted[sorted.length - 1] || 0,
    items,
  };
}
