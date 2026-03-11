/**
 * EXIF GPS extraction from uploaded photos.
 * Uses exifr for JPEG/HEIC/TIFF support.
 */

import * as exifr from "exifr";

export interface ExifGps {
  lat: number;
  lng: number;
  altitude?: number;
  timestamp?: string;
  camera?: string;
}

/**
 * Extract GPS coordinates from an image buffer.
 * Returns null if no GPS data is present (stripped, screenshot, etc.)
 */
export async function extractGpsFromPhoto(
  buffer: ArrayBuffer | Buffer
): Promise<ExifGps | null> {
  try {
    const gps = await exifr.gps(buffer);
    if (!gps || typeof gps.latitude !== "number" || typeof gps.longitude !== "number") {
      return null;
    }

    // Also try to get timestamp and camera model
    let timestamp: string | undefined;
    let camera: string | undefined;
    let altitude: number | undefined;

    try {
      const meta = await exifr.parse(buffer, {
        pick: ["DateTimeOriginal", "Model", "GPSAltitude"],
      });
      if (meta) {
        if (meta.DateTimeOriginal instanceof Date) {
          timestamp = meta.DateTimeOriginal.toISOString();
        }
        if (typeof meta.Model === "string") {
          camera = meta.Model;
        }
        if (typeof meta.GPSAltitude === "number") {
          altitude = meta.GPSAltitude;
        }
      }
    } catch {
      // Extra metadata is optional
    }

    return {
      lat: gps.latitude,
      lng: gps.longitude,
      altitude,
      timestamp,
      camera,
    };
  } catch {
    return null;
  }
}
