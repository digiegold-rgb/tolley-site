import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scan/public
 *
 * Public read of Scan & Know. Product metadata + dossier shape.
 * No real scan results — user-private.
 */
export async function GET() {
  return NextResponse.json(
    {
      product: "Scan & Know",
      url: "https://www.tolley.io/scan",
      summary:
        "Photo-to-dossier scanner. Drop a photo of a property, person, or vehicle and get a researched dossier.",
      modules: ["property", "person", "vehicle"],
      pricing: { perScan: 0.99, monthly: 19, currency: "USD" },
      capabilities: [
        "EXIF + reverse-image geolocation",
        "Property dossier (parcel, owner, listing history, market)",
        "Person dossier (public profiles, OpenManus narrative synthesis)",
        "Vehicle VIN decode + auction history",
        "Brave + Google + SerpAPI search fan-out",
        "Async polling with cron safety net",
      ],
      schemas: {
        Dossier: {
          subject: "string",
          phases: "Phase[]",
          synthesis: "string",
          sources: "string[]",
          generatedAt: "ISO date",
        },
      },
      cta: {
        try: "https://www.tolley.io/snap-and-know",
        signup: "https://www.tolley.io/signup",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
