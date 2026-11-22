import { crawlAllowed } from "./discovery-robots";
import { publicOfferings } from "./discovery";
import { DISCOVERY_BASE } from "./discovery-facts";
import { discoveryDocumentIssues, discoverySitemapPaths } from "./discovery-document";

export type HealthResult = { path: string; ok: boolean; status?: number; finalUrl?: string; issues: string[] };
export const DISCOVERY_SEARCH_AGENTS = ["Googlebot", "bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "DuckAssistBot"];

export async function checkDiscoveryHealth(base = DISCOVERY_BASE, fetcher: typeof fetch = fetch): Promise<HealthResult[]> {
  const offers = publicOfferings();
  let robots = "", sitemap = "";
  const results: HealthResult[] = [];
  // Keep the existing 300-second daily job bounded even during an origin outage.
  const deadline = Date.now() + 240000;
  async function inspect(path: string): Promise<HealthResult> {
    try {
      if (Date.now() >= deadline) throw new Error("Health-check deadline exceeded; page not checked");
      const r = await fetcher(new URL(path, base), { redirect: "follow", signal: AbortSignal.timeout(Math.min(12000, deadline - Date.now())), headers: { "User-Agent": "TolleyDiscoveryHealth/2.0" } });
      const body = await r.text();
      const issues: string[] = [];
      if (r.status !== 200) issues.push(`HTTP ${r.status}`);
      const expected = new URL(path, base);
      const final = new URL(r.url || expected);
      if (final.origin !== expected.origin || final.pathname !== expected.pathname || final.search !== expected.search) issues.push("Unexpected redirect");
      if (/\b(noindex|none)\b/i.test(r.headers.get("x-robots-tag") || "")) issues.push("Response header is noindex");
      if (path === "/robots.txt") {
        robots = body;
        if (!body.includes("OAI-SearchBot")) issues.push("Missing explicit search crawler rule");
      } else if (path === "/sitemap.xml") {
        sitemap = body;
        const paths = discoverySitemapPaths(body, DISCOVERY_BASE);
        if (!paths.length) issues.push("Sitemap has no canonical public pages");
        for (const s of offers) if (!paths.includes(s.url)) issues.push(`Missing sitemap route ${s.url}`);
        if (paths.length > 500) issues.push("Sitemap exceeds daily probe limit; expand or partition monitoring");
      } else if (path.endsWith(".txt")) {
        for (const s of offers) if (!body.includes(s.discovery!.canonicalUrl)) issues.push(`Missing offering ${s.url}`);
      } else if (path.startsWith("/api/") || path.endsWith(".json")) {
        try {
          const data = JSON.parse(body);
          if (!data || typeof data !== "object") issues.push("Expected a JSON discovery document");
          if (path === "/api/v1/knowledge?q=washer" && !data.items?.some((item: { sources?: string[] }) => item.sources?.includes(`${DISCOVERY_BASE}/wd`))) issues.push("Washer knowledge lookup has no sourced answer");
        } catch { issues.push("Invalid JSON discovery document"); }
      } else {
        issues.push(...discoveryDocumentIssues(body, DISCOVERY_BASE + path));
        const s = offers.find(s => s.url === path);
        if (s) {
          // Script payloads alone do not establish readable public facts.
          const html = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
          if (!html.includes('id="service-details"')) issues.push("Public service details missing");
          if (s.discovery?.phone && !html.includes(s.discovery.phone)) issues.push("Business phone missing");
        }
      }
      return { path, ok: issues.length === 0, status: r.status, finalUrl: r.url, issues };
    } catch (e) { return { path, ok: false, issues: [e instanceof Error ? e.message : "Fetch failed"] }; }
  }
  results.push(...await Promise.all(["/robots.txt", "/sitemap.xml"].map(inspect)));
  const paths = [...new Set(["/", "/services", "/llms.txt", "/llms-full.txt", "/api/agent-index", "/api/openapi.json", "/api/v1/capabilities", "/api/v1/knowledge?q=washer", "/.well-known/agent-card.json", ...offers.map(s => s.url), ...discoverySitemapPaths(sitemap, DISCOVERY_BASE).slice(0, 500)])];
  // Four concurrent read-only GETs; never submit leads, initiate payments, or render video.
  for (let i = 0; i < paths.length; i += 4) results.push(...await Promise.all(paths.slice(i, i + 4).map(inspect)));
  for (const result of results) {
    for (const agent of DISCOVERY_SEARCH_AGENTS) {
      if (!crawlAllowed(robots, result.path, agent)) result.issues.push(`${agent} disallowed by robots.txt`);
    }
    result.ok = result.issues.length === 0;
  }
  // Synthetic UA requests test edge handling, not genuine crawler IPs or indexing.
  for (const agent of ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]) {
    try {
      const response = await fetcher(new URL("/services", base), { signal: AbortSignal.timeout(12000), headers: { "User-Agent": agent } });
      const body = await response.text();
      if (response.status !== 200 || !body.includes("Services, rentals")) throw new Error("public content unavailable");
    } catch {
      const result = results.find(r => r.path === "/services")!;
      result.issues.push(`Synthetic ${agent} request failed`); result.ok = false;
    }
  }
  return results;
}
