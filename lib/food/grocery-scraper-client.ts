import crypto from "crypto";

const BASE_URL = process.env.GROCERY_SCRAPER_URL || "https://grocery-scrape.tolley.io";
const SECRET = process.env.GROCERY_HMAC_SECRET || "";

export type StoreKey = "walmart" | "samsclub";

export interface StoreStatus {
  store: StoreKey;
  label: string;
  loggedIn: boolean;
  cookieAgeDays: number | null;
  lastFetchAt: string | null;
  lastFetchOk: boolean | null;
  finalUrl: string | null;
  error: string | null;
}

export interface FetchResult {
  ok: boolean;
  store?: string;
  url?: string;
  capturedAt?: string;
  hasNextData?: boolean;
  payload?: string;
  nextData?: string | null;
  error?: string;
  needsLogin?: boolean;
}

function signRequest(body: string): { ts: string; sig: string } {
  if (!SECRET) {
    throw new Error("GROCERY_HMAC_SECRET not configured in this environment");
  }
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex");
  return { ts, sig };
}

export async function getStoreStatus(store: StoreKey): Promise<StoreStatus> {
  const { ts, sig } = signRequest("");
  const res = await fetch(`${BASE_URL}/${store}/status`, {
    method: "GET",
    headers: { "X-Grocery-Sig": sig, "X-Grocery-Ts": ts },
    cache: "no-store",
    // Status check involves launching a headless browser → slow. Allow up to 60s.
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`grocery-scraper status ${store} → ${res.status}`);
  }
  return (await res.json()) as StoreStatus;
}

export async function fetchStoreOrders(store: StoreKey): Promise<FetchResult> {
  const { ts, sig } = signRequest("");
  const res = await fetch(`${BASE_URL}/${store}/fetch`, {
    method: "POST",
    headers: {
      "X-Grocery-Sig": sig,
      "X-Grocery-Ts": ts,
      "Content-Type": "application/json",
    },
    body: "",
    cache: "no-store",
    // Full-page scrape with 3 scroll rounds → up to 90s.
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`grocery-scraper fetch ${store} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as FetchResult;
}
