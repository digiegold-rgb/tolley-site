/**
 * POST /api/vater/listing/property-image — "No photo? Use the address."
 *
 * Geocodes + checks Street View coverage (lib/video/fetch-property-image.ts),
 * then copies the JPEG to Vercel Blob server-side. The Street View URL
 * embeds GOOGLE_MAPS_API_KEY and is NEVER returned to the browser — only the
 * Blob copy is. Body: PropertyImageRequest → PropertyImageResponse.
 */
import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

import { auth } from "@/auth";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { fetchPropertyImage, isPropertyImageError } from "@/lib/video/fetch-property-image";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import { listingError, loginRequired, NO_STORE } from "@/lib/vater/listing/store";
import type { PropertyImageRequest, PropertyImageResponse } from "@/lib/vater/listing/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const ident = await resolveTenantIdentity(session.user.id);
  const rl = await consumeRateLimit(`vater:listing:streetview:${ident.rootUserId}`, 20, 600);
  if (!rl.allowed) return rateLimited(rl);

  let body: Partial<PropertyImageRequest>;
  try {
    body = (await request.json()) as Partial<PropertyImageRequest>;
  } catch {
    return listingError(400, { error: "Invalid JSON" });
  }
  const address = str(body.address, 200);
  const city = str(body.city, 80);
  const state = str(body.state, 2).toUpperCase();
  const zip = str(body.zip, 10);
  if (!address) return listingError(400, { error: "address is required", code: "no_address" });

  const result = await fetchPropertyImage(address, city, state);
  if (isPropertyImageError(result)) {
    const status = result.error === "no_api_key" ? 503 : 422;
    return NextResponse.json({ error: result.message, code: result.error }, { status, headers: NO_STORE });
  }

  let bytes: ArrayBuffer;
  try {
    const r = await fetch(result.imageUrl, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`street view ${r.status}`);
    bytes = await r.arrayBuffer();
  } catch (err) {
    console.error("[listing/property-image] street view fetch failed", err);
    return NextResponse.json({ error: "Could not fetch the Street View image. Try uploading a photo." }, { status: 502, headers: NO_STORE });
  }
  if (bytes.byteLength < 2_000) {
    return NextResponse.json({ error: "Street View returned an empty image for this address." }, { status: 422, headers: NO_STORE });
  }

  try {
    const blob = await put(`listing/${session.user.id}/${randomUUID()}.jpg`, Buffer.from(bytes), {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });
    const out: PropertyImageResponse = {
      imageUrl: blob.url,
      lat: result.lat,
      lng: result.lng,
      formatted: [address, city, state, zip].filter(Boolean).join(", "),
    };
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) {
    console.error("[listing/property-image] blob put failed", err);
    return NextResponse.json({ error: "Could not store the image." }, { status: 500, headers: NO_STORE });
  }
}
