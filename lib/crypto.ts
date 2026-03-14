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
