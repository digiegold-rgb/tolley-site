import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface GeoCache {
  data: Record<string, unknown>;
  ts: number;
}

const cache = new Map<string, GeoCache>();
const CACHE_TTL = 3600000; // 1 hour

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "0.0.0.0";

  // Don't geo-locate private IPs
  if (
    ip === "0.0.0.0" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.")
  ) {
    return NextResponse.json({
      city: "Kansas City",
      region: "MO",
      zip: "64106",
      lat: 39.0997,
      lon: -94.5786,
    });
  }

  // Check cache
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,region,zip,lat,lon`,
      { signal: AbortSignal.timeout(5000) },
    );
    const json = await res.json();

    if (json.status === "success") {
      const data = {
        city: json.city || "Kansas City",
        region: json.region || "MO",
        zip: json.zip || "",
        lat: json.lat || 39.0997,
        lon: json.lon || -94.5786,
      };
      cache.set(ip, { data, ts: Date.now() });
      return NextResponse.json(data);
    }
  } catch {
    // fall through to default
  }

  return NextResponse.json({
    city: "Kansas City",
    region: "MO",
    zip: "64106",
    lat: 39.0997,
    lon: -94.5786,
  });
}
