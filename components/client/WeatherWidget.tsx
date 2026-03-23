"use client";

import { useState, useEffect } from "react";

interface WeatherData {
  current: {
    temp: number | null;
    humidity: number | null;
    windSpeed: string | null;
    description: string | null;
  } | null;
  forecast: {
    shortForecast: string;
    detailedForecast: string;
    isDaytime: boolean;
  } | null;
  alerts: { headline: string; severity: string; description: string }[];
}

export function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/api/client/weather")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data?.current) {
    return (
      <div className="cl-card" style={{ padding: "1.5rem" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cl-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          KC Weather
        </div>
        <div style={{ marginTop: "8px", color: "var(--cl-text-light)", fontSize: "0.9rem" }}>Loading…</div>
      </div>
    );
  }

  const { current, forecast, alerts } = data;

  return (
    <div className="cl-card" style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cl-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Kansas City Weather
          </div>
          <div style={{ marginTop: "8px", display: "flex", alignItems: "baseline", gap: "8px" }}>
            {current.temp !== null && (
              <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--cl-text)", lineHeight: 1 }}>
                {current.temp}°
              </span>
            )}
            <span style={{ fontSize: "0.95rem", color: "var(--cl-text-muted)" }}>
              {current.description || forecast?.shortForecast || ""}
            </span>
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "1.5rem", fontSize: "0.8rem", color: "var(--cl-text-light)" }}>
            {current.humidity !== null && <span>Humidity: {current.humidity}%</span>}
            {current.windSpeed && <span>Wind: {current.windSpeed}</span>}
          </div>
        </div>
        {forecast && (
          <div style={{ fontSize: "0.8rem", color: "var(--cl-text-muted)", maxWidth: "280px", lineHeight: 1.5 }}>
            {forecast.detailedForecast.slice(0, 200)}
            {forecast.detailedForecast.length > 200 ? "…" : ""}
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                background: a.severity === "Extreme" || a.severity === "Severe"
                  ? "rgba(248, 113, 113, 0.12)"
                  : "rgba(201, 168, 76, 0.1)",
                color: a.severity === "Extreme" || a.severity === "Severe"
                  ? "#F87171"
                  : "var(--cl-gold-light)",
                border: `1px solid ${a.severity === "Extreme" || a.severity === "Severe" ? "rgba(248,113,113,0.2)" : "rgba(201,168,76,0.15)"}`,
              }}
            >
              ⚠ {a.headline}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
