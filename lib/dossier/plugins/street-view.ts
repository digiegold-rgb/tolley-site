/**
 * Street View Plugin — property and neighborhood imagery.
 *
 * Priority: 50 (independent — can run in parallel conceptually)
 * Sources: Google Street View Static API, Google Static Maps API
 *
 * REQUIRES: GOOGLE_MAPS_API_KEY for automated image URLs.
 * Falls back to Google Maps links if not configured.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

export const streetViewPlugin: DossierPlugin = {
  name: "street-view",
  label: "Property & Area Photos",
  description: "Generates street view, satellite, and neighborhood imagery for the property",
  category: "property",
  enabled: true,
  priority: 50,
  estimatedDuration: "30 sec",
  requiredConfig: [], // Works without API key (uses Google Maps links); enhanced with GOOGLE_MAPS_API_KEY
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    if (!listing.lat || !listing.lng) {
      return {
        pluginName: "street-view",
        success: false,
        error: "No lat/lng available for property",
        data: {},
        sources: [],
        confidence: 0,
        warnings: [],
        durationMs: Date.now() - start,
      };
    }

    await context.updateProgress("Generating property imagery...");

    const lat = listing.lat;
    const lng = listing.lng;
    const address = listing.address;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    let streetViewUrl: string | null = null;
    let satelliteUrl: string | null = null;
    const neighborhoodPhotos: string[] = [];

    if (apiKey) {
      // ── Google Street View Static API ──
      streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${lat},${lng}&key=${apiKey}&fov=120`;
      // Verify the image exists (Google returns a "sorry" image if no coverage)
      try {
        const metaRes = await fetch(
          `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`,
          { signal: AbortSignal.timeout(5000) }
        );
        const meta = await metaRes.json();
        if (meta.status !== "OK") {
          warnings.push("No Street View coverage for this location");
          streetViewUrl = null;
        }
      } catch {
        // Still provide URL — might work
      }

      // ── Satellite view ──
      satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=18&size=800x400&maptype=satellite&key=${apiKey}`;

      // ── Neighborhood overview (zoomed out) ──
      neighborhoodPhotos.push(
        `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=800x400&maptype=roadmap&key=${apiKey}`
      );

      // ── Street View from multiple angles ──
      for (const heading of [0, 90, 180, 270]) {
        neighborhoodPhotos.push(
          `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${lat},${lng}&heading=${heading}&key=${apiKey}&fov=90`
        );
      }
    } else {
      warnings.push("GOOGLE_MAPS_API_KEY not set — providing Google Maps links instead of static images");
    }

    // ── Always provide clickable map links (free, no API key needed) ──

    // Google Maps link
    const gmapsUrl = `https://www.google.com/maps/place/${encodeURIComponent(address)}/@${lat},${lng},18z`;
    sources.push({
      label: "Google Maps: property location",
      url: gmapsUrl,
      type: "map",
    });

    // Google Maps satellite view
    const gmapsSatUrl = `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e1`;
    sources.push({
      label: "Google Maps: satellite view",
      url: gmapsSatUrl,
      type: "map",
    });

    // Google Street View link
    const gsvUrl = `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m4!1e1!3m2!1s!2e0`;
    sources.push({
      label: "Google Street View: property",
      url: gsvUrl,
      type: "map",
    });

    // Bing Maps bird's eye view
    const bingUrl = `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=18&style=b`;
    sources.push({
      label: "Bing Maps: bird's eye view",
      url: bingUrl,
      type: "map",
    });

    // Zillow property page (often has photos)
    const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(
      `${address} ${listing.city || ""} ${listing.state || ""}`
    )}_rb/`;
    sources.push({
      label: "Zillow: property photos & details",
      url: zillowUrl,
      type: "commercial",
    });

    // Realtor.com (also has photos)
    const realtorUrl = `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(
      `${address} ${listing.city || ""} ${listing.state || ""}`
    ).replace(/%20/g, "-")}`;
    sources.push({
      label: "Realtor.com: property page",
      url: realtorUrl,
      type: "commercial",
    });

    // ── Future: add aerial/drone imagery sources here ──
    // ── Future: add historical Street View comparison ──

    return {
      pluginName: "street-view",
      success: true,
      data: {
        streetViewUrl,
        satelliteUrl,
        neighborhoodPhotos,
        mlsPhotos: listing.photoUrls, // Pass through MLS photos
        googleMapsUrl: gmapsUrl,
      },
      sources,
      confidence: streetViewUrl ? 0.9 : 0.5,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
