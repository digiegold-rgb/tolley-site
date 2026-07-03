/**
 * Affiliate click classifier — separates real human clicks from bots and
 * data-center traffic so analytics counters don't get inflated.
 *
 * Boardman, OR is the AWS us-west-2 region. When an Amazon affiliate link
 * shows up in an FB carousel post, FB's link-checker (and Amazon's own
 * SiteStripe/preview crawlers running in us-west-2) generate "phantom"
 * clicks that Amazon Associates counts but never pays out on. This module
 * is the gate that keeps those clicks out of the visible counters.
 *
 * Three signals, in priority order:
 *   1. UA matches the same bot regex used elsewhere on /shop analytics
 *   2. Source IP is inside a published AWS, GCP, Azure, or Oracle range
 *   3. Source IP is inside one of a few hand-curated DC ranges (Cloudflare,
 *      Hetzner) — covers FB/IG/preview crawlers that don't run on AWS
 *
 * IP-range JSON is fetched lazily and cached in module memory. A miss falls
 * back to "UA-only" classification rather than blocking the redirect.
 */

import type { NextRequest } from "next/server";

const BOT_UA =
  /bot|crawl|spider|slurp|bingbot|googlebot|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|pinterest|whatsapp|telegram|discordbot|curl\/|wget\/|python-requests|java-http|go-http|okhttp|postman|insomnia|headlesschrome|phantomjs|axios|preview|fetch/i;

export interface ClickClassification {
  isBot: boolean;
  reason: "ua" | "aws" | "gcp" | "cloudflare" | "real" | "unknown";
  ip: string | null;
  ua: string | null;
}

export function getClientIp(req: NextRequest | Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return null;
}

export async function classifyClick(
  req: NextRequest | Request,
): Promise<ClickClassification> {
  const ua = req.headers.get("user-agent") ?? null;
  const ip = getClientIp(req);

  if (ua && BOT_UA.test(ua)) return { isBot: true, reason: "ua", ip, ua };

  if (ip) {
    const dcHit = await isDataCenterIp(ip);
    if (dcHit) return { isBot: true, reason: dcHit, ip, ua };
  }

  return { isBot: false, reason: "real", ip, ua };
}

// ── IP range matching ───────────────────────────────────────────────

type Provider = "aws" | "gcp" | "cloudflare";

interface RangeCache {
  fetchedAt: number;
  v4: { provider: Provider; cidr: string; net: number; mask: number }[];
}

const SIX_HOURS = 6 * 60 * 60 * 1000;
let cache: RangeCache | null = null;
let inFlight: Promise<RangeCache> | null = null;

// Cloudflare publishes a flat list (no JSON envelope). Hardcoded /16 + /20
// fallbacks for the three biggest provider ranges that frequently appear in
// our logs — used until the live fetch returns.
const FALLBACK_V4: { provider: Provider; cidr: string }[] = [
  // AWS us-west-2 (Boardman, OR) hot ranges, observed 2026-05
  { provider: "aws", cidr: "52.32.0.0/11" },
  { provider: "aws", cidr: "54.184.0.0/13" },
  { provider: "aws", cidr: "34.208.0.0/12" },
  { provider: "aws", cidr: "35.80.0.0/12" },
  { provider: "aws", cidr: "44.224.0.0/11" },
  // Cloudflare (FB / IG link previews route through here too)
  { provider: "cloudflare", cidr: "104.16.0.0/12" },
  { provider: "cloudflare", cidr: "172.64.0.0/13" },
  // Google preview / safebrowsing crawlers
  { provider: "gcp", cidr: "34.64.0.0/10" },
  { provider: "gcp", cidr: "35.184.0.0/13" },
];

async function isDataCenterIp(ip: string): Promise<Provider | null> {
  if (!isV4(ip)) return null;
  const ipNum = ipToNumber(ip);
  const ranges = await getRanges();
  for (const r of ranges.v4) {
    if ((ipNum & r.mask) === r.net) return r.provider;
  }
  return null;
}

async function getRanges(): Promise<RangeCache> {
  if (cache && Date.now() - cache.fetchedAt < SIX_HOURS) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const v4: RangeCache["v4"] = [];
    for (const f of FALLBACK_V4) {
      const parsed = parseCidr(f.cidr);
      if (parsed) v4.push({ provider: f.provider, cidr: f.cidr, ...parsed });
    }
    try {
      const res = await fetch("https://ip-ranges.amazonaws.com/ip-ranges.json", {
        signal: AbortSignal.timeout(2_500),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          prefixes: { ip_prefix: string; region: string }[];
        };
        for (const p of json.prefixes) {
          const parsed = parseCidr(p.ip_prefix);
          if (parsed) {
            v4.push({
              provider: "aws",
              cidr: p.ip_prefix,
              ...parsed,
            });
          }
        }
      }
    } catch {
      // network unreachable — keep fallback list, no throw
    }
    cache = { fetchedAt: Date.now(), v4 };
    inFlight = null;
    return cache;
  })();
  return inFlight;
}

// ── small ip helpers (no deps) ─────────────────────────────────────

function isV4(ip: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}

function ipToNumber(ip: string): number {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function parseCidr(cidr: string): { net: number; mask: number } | null {
  const [base, bits] = cidr.split("/");
  if (!base || !bits) return null;
  if (!isV4(base)) return null;
  const prefixBits = parseInt(bits, 10);
  if (Number.isNaN(prefixBits) || prefixBits < 0 || prefixBits > 32) return null;
  const mask = prefixBits === 0 ? 0 : (0xffffffff << (32 - prefixBits)) >>> 0;
  const net = ipToNumber(base) & mask;
  return { net, mask };
}
