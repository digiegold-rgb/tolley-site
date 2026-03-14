const ENGINE_URL = process.env.CRYPTO_ENGINE_URL || "http://localhost:8950";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

export async function fetchEngineStatus() {
  const res = await fetch(`${ENGINE_URL}/status`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Engine status failed: ${res.status}`);
  return res.json();
}

export async function fetchEngineTrades(limit = 50) {
  const res = await fetch(`${ENGINE_URL}/trades?limit=${limit}`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Engine trades failed: ${res.status}`);
  return res.json();
}

export async function fetchEngineEquity() {
  const res = await fetch(`${ENGINE_URL}/equity`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Engine equity failed: ${res.status}`);
  return res.json();
}

export async function triggerKillSwitch() {
  const res = await fetch(`${ENGINE_URL}/kill`, {
    method: "POST",
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Kill switch failed: ${res.status}`);
  return res.json();
}

export async function fetchMarketOverview() {
  const res = await fetch(`${ENGINE_URL}/market/overview`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Market overview failed: ${res.status}`);
  return res.json();
}

export async function fetchGainersLosers(limit = 10) {
  const res = await fetch(`${ENGINE_URL}/market/gainers-losers?limit=${limit}`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Gainers/losers failed: ${res.status}`);
  return res.json();
}

export async function fetchFuturesData() {
  const res = await fetch(`${ENGINE_URL}/market/futures`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Futures data failed: ${res.status}`);
  return res.json();
}

export async function fetchDiscovery() {
  const res = await fetch(`${ENGINE_URL}/discovery`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
  return res.json();
}

export async function fetchTVSignals() {
  const res = await fetch(`${ENGINE_URL}/signals/tv`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`TV signals failed: ${res.status}`);
  return res.json();
}

export async function fetchSentiment() {
  const res = await fetch(`${ENGINE_URL}/sentiment`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Sentiment failed: ${res.status}`);
  return res.json();
}

export async function fetchDataSources() {
  const res = await fetch(`${ENGINE_URL}/data-sources`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Data sources failed: ${res.status}`);
  return res.json();
}

export async function fetchValidation() {
  const res = await fetch(`${ENGINE_URL}/validation`, {
    headers: { "x-sync-secret": SYNC_SECRET },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Validation failed: ${res.status}`);
  return res.json();
}

export async function switchMode(mode: "paper" | "live") {
  const res = await fetch(`${ENGINE_URL}/mode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": SYNC_SECRET,
    },
    body: JSON.stringify({ mode }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail?.error || `Mode switch failed: ${res.status}`);
  }
  return res.json();
}
