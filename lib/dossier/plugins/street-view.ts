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
    const address = listing.address;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // ── Resolve coordinates ──
    // Prefer whatever the listing shipped with. If missing, attempt a
    // Google geocode (only if we have the API key). If that also fails,
    // continue with address-only fallback — we can still emit useful
    // clickable links even without static imagery.
    let lat = listing.lat;
    let lng = listing.lng;

    if ((!lat || !lng) && apiKey) {
      await context.updateProgress("Geocoding address for imagery...");
      try {
        const fullAddress = [
          listing.address,
          listing.city,
          listing.state,
          listing.zip,
        ]
          .filter(Boolean)
          .join(", ");
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const loc = geoData?.results?.[0]?.geometry?.location;
          if (loc?.lat && loc?.lng) {
            lat = loc.lat;
            lng = loc.lng;
            warnings.push(`Geocoded address to ${lat},${lng}`);
          } else if (geoData?.status) {
            warnings.push(`Geocoding returned status: ${geoData.status}`);
          }
        }
      } catch (err) {
        warnings.push(
          `Geocoding failed: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    } else if (!lat || !lng) {
      warnings.push(
        "No lat/lng on listing and GOOGLE_MAPS_API_KEY not set — using address-based fallback links"
      );
    }

    await context.updateProgress("Generating property imagery...");

    let streetViewUrl: string | null = null;
    let satelliteUrl: string | null = null;
    const neighborhoodPhotos: string[] = [];

    if (apiKey && lat && lng) {
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
    } else if (!apiKey) {
      warnings.push(
        "GOOGLE_MAPS_API_KEY not set — providing Google Maps links instead of static images"
      );
    }

    // ── Always provide clickable map links ──
    // Prefer coordinate-based URLs when available, otherwise fall back to
    // address-based URLs so the links still work even without geocoding.
    const fullAddress = [
      listing.address,
      listing.city,
      listing.state,
      listing.zip,
    ]
      .filter(Boolean)
      .join(", ");
    const addressQuery = encodeURIComponent(fullAddress);

    // Google Maps link — address search works without coordinates
    const gmapsUrl = lat && lng
      ? `https://www.google.com/maps/place/${encodeURIComponent(address)}/@${lat},${lng},18z`
      : `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
    sources.push({
      label: "Google Maps: property location",
      url: gmapsUrl,
      type: "map",
    });

    // Google Maps satellite view — coords preferred; address search falls
    // back to regular view (Google can't force satellite without coords).
    if (lat && lng) {
      sources.push({
        label: "Google Maps: satellite view",
        url: `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e1`,
        type: "map",
      });

      sources.push({
        label: "Google Street View: property",
        url: `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m4!1e1!3m2!1s!2e0`,
        type: "map",
      });

      sources.push({
        label: "Bing Maps: bird's eye view",
        url: `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=18&style=b`,
        type: "map",
      });
    } else {
      // Address-based street view link
      sources.push({
        label: "Google Street View (search by address)",
        url: `https://www.google.com/maps/search/?api=1&query=${addressQuery}&basemap=satellite`,
        type: "map",
      });
    }

    // Zillow property page (works by address)
    const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(
      `${address} ${listing.city || ""} ${listing.state || ""}`
    )}_rb/`;
    sources.push({
      label: "Zillow: property photos & details",
      url: zillowUrl,
      type: "commercial",
    });

    // Realtor.com (works by address)
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

    // Confidence scaled by how much we were able to gather:
    //   - static street view images: 0.9
    //   - coords + clickable links but no images: 0.6
    //   - address-only fallback links: 0.3
    const confidence = streetViewUrl ? 0.9 : lat && lng ? 0.6 : 0.3;

    return {
      pluginName: "street-view",
      success: true,
      data: {
        streetViewUrl,
        satelliteUrl,
        neighborhoodPhotos,
        mlsPhotos: listing.photoUrls, // Pass through MLS photos
        googleMapsUrl: gmapsUrl,
        resolvedLat: lat,
        resolvedLng: lng,
      },
      sources,
      confidence,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
