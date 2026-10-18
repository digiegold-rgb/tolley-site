import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP, BlockList } from "node:net";
import { COMPANY_POLICY, CompanyError } from "./policy";
import { crawlAllowed } from "@/lib/discovery-robots";

const blocked = new BlockList();
for (const [ip, bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.168.0.0",16],["192.0.0.0",24],["192.0.2.0",24],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",3]] as const) blocked.addSubnet(ip, bits);
export function isPublicIPv4(ip: string) { return isIP(ip) === 4 && !blocked.check(ip); }
export function publicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443") || u.hostname === "localhost" || isIP(u.hostname.replace(/\[|\]/g, ""))) throw new CompanyError("unsafe_url");
  return u;
}
/** Pin a validated address for the entire TLS connection. Never follow redirects implicitly. */
export async function publicFetch(raw: string, options: { method?: "GET" | "POST"; body?: string; headers?: Record<string, string>; redirects?: number } = {}): Promise<{ status: number; text: string; url: string; type: string }> {
  const u = publicUrl(raw);
  const addresses = await lookup(u.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(a => !isPublicIPv4(a.address))) throw new CompanyError("unsafe_address");
  const result = await new Promise<{ status: number; text: string; location?: string; type: string }>((resolve, reject) => {
    const req = request(u, { method: options.method || "GET", family: 4, lookup: (_host, _options, cb) => cb(null, addresses[0].address, 4), headers: { "User-Agent": "TolleyResearchBot/1.0 (+https://www.tolley.io/services/agent)", ...options.headers }, timeout: 15000 }, res => {
      const parts: Buffer[] = []; let n = 0;
      res.on("data", chunk => { n += chunk.length; if (n > COMPANY_POLICY.maxSourceBytes) { res.destroy(); req.destroy(new CompanyError("source_too_large")); } else parts.push(chunk); });
      res.on("end", () => resolve({ status: res.statusCode || 502, text: Buffer.concat(parts).toString("utf8"), location: res.headers.location, type: String(res.headers["content-type"] || "") }));
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new CompanyError("source_timeout")), 20000);
    req.on("close", () => clearTimeout(timer)); req.on("timeout", () => req.destroy(new CompanyError("source_timeout"))); req.on("error", reject);
    req.end(options.body);
  });
  if (result.status >= 300 && result.status < 400 && result.location) {
    // Never forward webhook signatures or payloads to a redirected host.
    if (options.method === "POST" || (options.redirects || 0) >= 3) throw new CompanyError("redirect_rejected");
    return publicFetch(new URL(result.location, u).href, { ...options, redirects: (options.redirects || 0) + 1 });
  }
  return { ...result, url: u.href };
}
export async function readPublicSource(raw: string) {
  const u = publicUrl(raw);
  const robots = await publicFetch(new URL("/robots.txt", u).href);
  if (robots.status !== 404 && (robots.status !== 200 || !crawlAllowed(robots.text, u.pathname, "TolleyResearchBot"))) throw new CompanyError("source_disallows_crawl");
  // Recheck robots on every redirect target: fetch redirects explicitly here.
  const page = await publicFetch(u.href, { redirects: 3 });
  if (page.status !== 200 || !/(text\/|json|xml)/i.test(page.type)) throw new CompanyError("source_unavailable");
  const text = page.text.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot);/g, " ").replace(/\s+/g, " ").trim().slice(0, 30000);
  return { url: u.href, text, fetchedAt: new Date().toISOString() };
}
