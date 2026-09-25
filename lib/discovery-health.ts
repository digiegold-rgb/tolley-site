import { crawlAllowed } from "./discovery-robots";
import { publicOfferings } from "./discovery";
export type HealthResult = { path: string; ok: boolean; status?: number; finalUrl?: string; issues: string[] };
export async function checkDiscoveryHealth(base = "https://www.tolley.io", fetcher: typeof fetch = fetch): Promise<HealthResult[]> {
  const offers = publicOfferings();
  let robots = "";
  const paths = ["/services", "/llms.txt", "/llms-full.txt", "/robots.txt", "/sitemap.xml", ...offers.map(s => s.url)];
  const results: HealthResult[] = [];
  // Four concurrent GETs; never submit forms, initiate payments, or render video.
  for (let i = 0; i < paths.length; i += 4) {
    results.push(...await Promise.all(paths.slice(i, i + 4).map(async path => {
      try {
        const r = await fetcher(new URL(path, base), { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "TolleyDiscoveryHealth/1.0" } });
        const html = await r.text();
        const issues: string[] = [];
        if (r.status !== 200) issues.push(`HTTP ${r.status}`);
        if (new URL(r.url || new URL(path, base)).pathname !== path) issues.push("Unexpected redirect");
        if (/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) issues.push("Page is noindex");
        if (path === "/robots.txt") { robots = html; if (!html.includes("OAI-SearchBot")) issues.push("Missing explicit search crawler rule"); }
        if (path === "/sitemap.xml") for (const s of offers) if (!html.includes(s.url + "</loc>")) issues.push(`Missing sitemap route ${s.url}`);
        const s = offers.find(s => s.url === path);
        if (s) {
          if (!html.includes("service-details")) issues.push("Public service details missing");
          if (!html.includes(s.discovery!.canonicalUrl)) issues.push("Canonical URL missing");
          if (s.discovery?.phone && !html.includes(s.discovery.phone)) issues.push("Business phone missing");
        }
        return { path, ok: issues.length === 0, status: r.status, finalUrl: r.url, issues };
      } catch (e) { return { path, ok: false, issues: [e instanceof Error ? e.message : "Fetch failed"] }; }
    })));
  }
  for (const result of results) {
    if (!crawlAllowed(robots, result.path, "OAI-SearchBot")) {
      result.issues.push("Search crawler disallowed by robots.txt"); result.ok = false;
    }
  }
  // This probes user-agent handling, not actual OpenAI crawl provenance/IPs.
  for (const path of ["/cleanouts", "/services"]) {
    try {
      const response = await fetcher(new URL(path, base), { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)" } });
      const body = await response.text();
      if (response.status !== 200 || !body.includes(path === "/cleanouts" ? "service-details" : "Services, rentals")) {
        const result = results.find(r => r.path === path)!;
        result.issues.push("Synthetic search-user-agent request failed"); result.ok = false;
      }
    } catch {
      const result = results.find(r => r.path === path)!;
      result.issues.push("Synthetic search-user-agent request timed out"); result.ok = false;
    }
  }
  return results;
}
