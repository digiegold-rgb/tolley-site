"use client";

import { useEffect, useState } from "react";
import { predictWeatherImpact, type WeatherImpact } from "@/lib/water-chemistry";

interface CurrentWeather {
  temperature: number;
  humidity: number;
  uvIndex: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
}

interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  uvMax: number;
  precipSum: number;
  windMax: number;
  weatherCode: number;
}

interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
  fetchedAt: string;
}

function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  if (code <= 99) return "⛈️";
  return "🌤️";
}

function dayName(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tmrw";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function WaterWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [impacts, setImpacts] = useState<WeatherImpact[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/water/weather")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setWeather(data);
        if (data.current) {
          setImpacts(predictWeatherImpact({
            uvIndex: data.current.uvIndex,
            tempHigh: data.daily?.[0]?.tempMax ?? data.current.temperature,
            precipMm: data.daily?.[0]?.precipSum ?? data.current.precipitation,
            windSpeed: data.current.windSpeed,
          }));
        }
      })
      .catch(() => setError("Failed to load weather"));
  }, []);

  if (error) return <div className="water-card text-white/40 text-sm">{error}</div>;
  if (!weather) return <div className="water-card text-white/40 text-sm">Loading weather...</div>;

  const c = weather.current;

  return (
    <div className="water-card space-y-4">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Weather — Independence, MO</h3>

      {/* Current */}
      <div className="flex items-center gap-4">
        <span className="text-3xl">{weatherIcon(c.weatherCode)}</span>
        <div>
          <span className="text-2xl font-bold text-white">{Math.round(c.temperature)}°F</span>
          <div className="flex gap-3 text-xs text-white/40">
            <span>UV {c.uvIndex}</span>
            <span>{c.humidity}% hum</span>
            <span>{Math.round(c.windSpeed)} mph</span>
          </div>
        </div>
      </div>

      {/* 7-day forecast */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {weather.daily.map((d) => (
          <div key={d.date} className="flex flex-col items-center gap-1 rounded-lg bg-white/[0.03] px-2.5 py-2 text-xs min-w-[52px]">
            <span className="text-white/40">{dayName(d.date)}</span>
            <span>{weatherIcon(d.weatherCode)}</span>
            <span className="font-semibold text-white/80">{Math.round(d.tempMax)}°</span>
            <span className="text-white/30">{Math.round(d.tempMin)}°</span>
          </div>
        ))}
      </div>

      {/* Pool impacts */}
      {impacts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/40 uppercase">Pool Impact</h4>
          {impacts.map((imp, i) => (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 text-xs ${
                imp.severity === "high"
                  ? "border-red-500/20 bg-red-500/5 text-red-300"
                  : imp.severity === "medium"
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
                  : "border-white/10 bg-white/[0.02] text-white/50"
              }`}
            >
              {imp.recommendation}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
