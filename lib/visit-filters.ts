/**
 * Shared read-path filters for first-party visit data (SiteView / SiteEvent).
 *
 * Extracted from app/api/analytics/route.ts so /api/hq/site-visits applies
 * the exact same exclusions (bots, datacenter geo, self-IPs) and the two
 * dashboards can never disagree about what counts as a "real" visit.
 */
import { createHmac } from "crypto";

// Matches obvious bots, crawlers, and non-browser HTTP clients.
export const BOT_UA =
  /bot|crawl|spider|slurp|bingbot|googlebot|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|pinterest|whatsapp|telegram|discordbot|curl\/|wget\/|python-requests|java-http|go-http|okhttp|postman|insomnia|headlesschrome|phantomjs|axios/i;

export function isBot(ua: string | null): boolean {
  if (!ua) return false;
  return BOT_UA.test(ua);
}

// Known cloud / datacenter cities. Hits geolocated here are almost always
// scrapers, headless probes, or proxy egress — they never trip BOT_UA
// because the UA strings are spoofed to look like real browsers.
export const DATACENTER_CITIES = new Set<string>([
  // AWS
  "Ashburn", "Boardman", "Hilliard", "Manassas",
  // Google
  "Council Bluffs", "The Dalles", "Mayes", "Pryor",
  // Facebook / Meta
  "Prineville", "Forest City", "Luleå", "Lulea", "Altoona", "Henrico", "Eagle Mountain",
  // Microsoft / Azure
  "Clonee", "Quincy", "San Antonio", "Cheyenne",
  // Hetzner / OVH
  "Falkenstein", "Nuremberg", "Roubaix", "Strasbourg", "Gravelines",
  // DigitalOcean / Linode / Vultr
  "Secaucus", "Cedar Knolls", "Piscataway",
]);

export function isDatacenterGeo(city: string | null): boolean {
  if (!city) return false;
  return DATACENTER_CITIES.has(city);
}

export function hashIp(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

// Self-exclusion: comma-separated IPs in ANALYTICS_SKIP_IPS are filtered
// from dashboards on the read path (Jared checking his own site ≠ a visit).
export function getSkipIps(): Set<string> {
  return new Set(
    (process.env.ANALYTICS_SKIP_IPS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getSkipHashes(skipIps: Set<string>): Set<string> {
  const salt = process.env.ANALYTICS_IP_SALT;
  if (!salt) return new Set();
  const hashes = new Set<string>();
  for (const ip of skipIps) hashes.add(hashIp(ip, salt));
  return hashes;
}

// Dedup key for unique-visitor counts — prefer hash (new rows), fall back
// to raw ip (historical rows).
export function dedupKey(v: { ip: string | null; ipHash: string | null }): string | null {
  return v.ipHash || v.ip || null;
}

export interface VisitRowLike {
  ip: string | null;
  ipHash: string | null;
  userAgent: string | null;
  city?: string | null;
}

export function keepVisitRow(
  v: VisitRowLike,
  skipIps: Set<string>,
  skipHashes: Set<string>,
): boolean {
  if (v.ip && skipIps.has(v.ip)) return false;
  if (v.ipHash && skipHashes.has(v.ipHash)) return false;
  if (v.userAgent && BOT_UA.test(v.userAgent)) return false;
  if (isDatacenterGeo(v.city ?? null)) return false;
  return true;
}
