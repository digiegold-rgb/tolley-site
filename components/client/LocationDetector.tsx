"use client";

import { useEffect, useState } from "react";

export interface GeoLocation {
  city: string;
  region: string;
  zip: string;
  lat: number;
  lon: number;
}

const KC_DEFAULT: GeoLocation = {
  city: "Kansas City",
  region: "MO",
  zip: "64106",
  lat: 39.0997,
  lon: -94.5786,
};

const STORAGE_KEY = "cl_geo";

export function useLocation() {
  const [location, setLocation] = useState<GeoLocation>(KC_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.city && Date.now() - (parsed._ts || 0) < 3600000) {
          setLocation(parsed);
          setLoading(false);
          return;
        }
      } catch {
        // ignore
      }
    }

    fetch("/api/client/geo")
      .then((r) => r.json())
      .then((data) => {
        if (data.city) {
          const geo: GeoLocation = {
            city: data.city,
            region: data.region || "MO",
            zip: data.zip || "",
            lat: data.lat || KC_DEFAULT.lat,
            lon: data.lon || KC_DEFAULT.lon,
          };
          setLocation(geo);
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...geo, _ts: Date.now() }),
          );
        }
      })
      .catch(() => {
        // fall back to KC default
      })
      .finally(() => setLoading(false));
  }, []);

  return { location, loading };
}

export function LocationBadge({
  location,
  loading,
}: {
  location: GeoLocation;
  loading: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(8px)",
        borderRadius: "999px",
        padding: "6px 14px",
        fontSize: "0.8rem",
        fontWeight: 500,
        color: "rgba(255,255,255,0.9)",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      {loading ? (
        "Detecting location…"
      ) : (
        <>
          {location.city}, {location.region}
        </>
      )}
    </div>
  );
}
