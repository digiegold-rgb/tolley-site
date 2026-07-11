import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * SSRF egress guard. Validates that a user/DB-supplied URL is safe to fetch
 * server-side: http(s) only, and its resolved host is a public IP — never
 * loopback, link-local, private ranges, or the cloud metadata endpoint.
 *
 * Throws {@link UnsafeUrlError} on rejection. Call before any server-side
 * fetch of an untrusted URL (RSS probes, image fetches, link resolvers).
 */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true; // 10.0.0.0/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true; // "this" network
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 169 && p[1] === 254) return true; // link-local + metadata 169.254.169.254
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
    // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // unknown format → treat as unsafe
}

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Blocked scheme: ${url.protocol}`);
  }

  const host = url.hostname;
  // Literal IP in the host — check directly.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError(`Blocked private address: ${host}`);
    return url;
  }

  // Hostname — resolve every A/AAAA record and reject if ANY is private
  // (defends against DNS-rebinding-ish multi-record tricks).
  let addrs;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError(`Cannot resolve host: ${host}`);
  }
  if (addrs.length === 0) throw new UnsafeUrlError(`Host did not resolve: ${host}`);
  for (const { address } of addrs) {
    if (isPrivateIp(address)) {
      throw new UnsafeUrlError(`Host ${host} resolves to a private address`);
    }
  }
  return url;
}
