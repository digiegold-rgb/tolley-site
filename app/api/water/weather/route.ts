import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";

// Cache weather data for 30 minutes
let cachedWeather: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

const LAT = 39.0911;
const LNG = -94.4155;

export async function GET() {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (cachedWeather && Date.now() - cachedWeather.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cachedWeather.data);
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m,relative_humidity_2m,uv_index,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=mm&timezone=America/Chicago&forecast_days=7`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

    const raw = await res.json();

    const data = {
      current: {
        temperature: raw.current?.temperature_2m,
        humidity: raw.current?.relative_humidity_2m,
        uvIndex: raw.current?.uv_index,
        precipitation: raw.current?.precipitation,
        windSpeed: raw.current?.wind_speed_10m,
        weatherCode: raw.current?.weather_code,
      },
      daily: raw.daily?.time?.map((date: string, i: number) => ({
        date,
        tempMax: raw.daily.temperature_2m_max[i],
        tempMin: raw.daily.temperature_2m_min[i],
        uvMax: raw.daily.uv_index_max[i],
        precipSum: raw.daily.precipitation_sum[i],
        windMax: raw.daily.wind_speed_10m_max[i],
        weatherCode: raw.daily.weather_code[i],
      })) || [],
      fetchedAt: new Date().toISOString(),
    };

    cachedWeather = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch weather", detail: String(err) },
      { status: 502 },
    );
  }
}
