/**
 * IndexNow — push changed URLs to Bing (and every engine sharing the protocol)
 * instead of waiting for a crawl. ChatGPT search answers from Bing's index,
 * which is how tolley.io/cleanouts got recommended to a caller on 2026-09-24.
 *
 * Key: INDEXNOW_KEY (any 8–128 char [a-zA-Z0-9-]). It is served back at
 * /indexnow-key.txt so the endpoint can verify we own the host.
 */
export const INDEXNOW_HOST = "www.tolley.io";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export function indexNowKey(): string | null {
  const k = process.env.INDEXNOW_KEY?.trim();
  return k && /^[a-zA-Z0-9-]{8,128}$/.test(k) ? k : null;
}

export async function sitemapUrls(base = `https://${INDEXNOW_HOST}`, fetcher: typeof fetch = fetch): Promise<string[]> {
  const res = await fetcher(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "TolleyIndexNow/1.0" } });
  if (!res.ok) throw new Error(`sitemap.xml HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(u => u.startsWith(`https://${INDEXNOW_HOST}/`));
}

export type IndexNowResult = { ok: boolean; status: number; submitted: number; batches: number; error?: string };

/** Submit up to 10,000 URLs per request. Returns the first non-2xx status if any batch fails. */
export async function submitIndexNow(urls: string[], key = indexNowKey(), fetcher: typeof fetch = fetch): Promise<IndexNowResult> {
  if (!key) return { ok: false, status: 0, submitted: 0, batches: 0, error: "INDEXNOW_KEY is not set" };
  const list = [...new Set(urls.map(u => (u.startsWith("/") ? `https://${INDEXNOW_HOST}${u}` : u)))].filter(u => u.startsWith(`https://${INDEXNOW_HOST}/`) || u === `https://${INDEXNOW_HOST}`);
  if (!list.length) return { ok: false, status: 0, submitted: 0, batches: 0, error: "No tolley.io URLs to submit" };
  let submitted = 0, batches = 0;
  for (let i = 0; i < list.length; i += 10000) {
    const urlList = list.slice(i, i + 10000);
    const res = await fetcher(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: INDEXNOW_HOST, key, keyLocation: `https://${INDEXNOW_HOST}/indexnow-key.txt`, urlList }),
      signal: AbortSignal.timeout(20000),
    });
    batches++;
    // 200 = submitted, 202 = accepted pending key validation. Anything else is a real failure.
    if (res.status !== 200 && res.status !== 202) return { ok: false, status: res.status, submitted, batches, error: (await res.text().catch(() => "")).slice(0, 300) || `HTTP ${res.status}` };
    submitted += urlList.length;
  }
  return { ok: true, status: 200, submitted, batches };
}
