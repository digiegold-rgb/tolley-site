/** A captured lead is a durable record, never an analytics acknowledgement. */
export async function submitLead(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || (!data?.id && !data?.receiptToken)) {
    throw new Error(response.status === 429
      ? "Please wait a few minutes and try again, or call us."
      : "Your request was not saved. Please try again or call us.");
  }
  return data;
}

/** Campaign values only; never persist a URL's arbitrary query parameters. */
export function captureAttribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return { sessionId: visitorSessionId(), ...Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "ref"]
    .flatMap(key => params.get(key) ? [[key, params.get(key)!.slice(0, 120)]] : [])) };
}

export function visitorSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = sessionStorage.getItem("tolley_visit");
    if (existing) return existing;
    const id = crypto.randomUUID(); sessionStorage.setItem("tolley_visit", id); return id;
  } catch { return undefined; }
}
