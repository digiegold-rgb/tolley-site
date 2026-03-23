import { NextResponse } from "next/server";

export const runtime = "nodejs";

// NWS API — free, no key needed
const KC_GRID = "https://api.weather.gov/gridpoints/EAX/39,39/forecast";
const KC_CURRENT = "https://api.weather.gov/stations/KMCI/observations/latest";

interface WeatherData {
  temperature: number | null;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
  windSpeed: string | null;
  humidity: number | null;
  icon: string | null;
  isDaytime: boolean;
  alerts: { headline: string; severity: string; description: string }[];
}

export async function GET() {
  try {
    const headers = { "User-Agent": "(tolley.io, jared@yourkchomes.com)" };

    const [forecastRes, currentRes, alertsRes] = await Promise.all([
      fetch(KC_GRID, { headers, next: { revalidate: 1800 } }),
      fetch(KC_CURRENT, { headers, next: { revalidate: 900 } }),
      fetch("https://api.weather.gov/alerts/active?area=MO&limit=5", {
        headers,
        next: { revalidate: 900 },
      }),
    ]);

    let forecast: WeatherData | null = null;
    let current: { temp: number | null; humidity: number | null; windSpeed: string | null; description: string | null } | null = null;
    let alerts: { headline: string; severity: string; description: string }[] = [];

    if (forecastRes.ok) {
      const fData = await forecastRes.json();
      const period = fData.properties?.periods?.[0];
      if (period) {
        forecast = {
          temperature: period.temperature,
          temperatureUnit: period.temperatureUnit || "F",
          shortForecast: period.shortForecast,
          detailedForecast: period.detailedForecast,
          windSpeed: period.windSpeed,
          humidity: period.relativeHumidity?.value ?? null,
          icon: period.icon,
          isDaytime: period.isDaytime,
          alerts: [],
        };
      }
    }

    if (currentRes.ok) {
      const cData = await currentRes.json();
      const props = cData.properties;
      if (props) {
        const tempC = props.temperature?.value;
        current = {
          temp: tempC !== null && tempC !== undefined ? Math.round(tempC * 9 / 5 + 32) : null,
          humidity: props.relativeHumidity?.value ? Math.round(props.relativeHumidity.value) : null,
          windSpeed: props.windSpeed?.value ? `${Math.round(props.windSpeed.value * 0.621371)} mph` : null,
          description: props.textDescription || null,
        };
      }
    }

    if (alertsRes.ok) {
      const aData = await alertsRes.json();
      alerts = (aData.features || [])
        .filter((f: { properties?: { areaDesc?: string } }) =>
          f.properties?.areaDesc?.toLowerCase().includes("jackson") ||
          f.properties?.areaDesc?.toLowerCase().includes("kansas city") ||
          f.properties?.areaDesc?.toLowerCase().includes("clay") ||
          f.properties?.areaDesc?.toLowerCase().includes("platte") ||
          f.properties?.areaDesc?.toLowerCase().includes("cass")
        )
        .slice(0, 3)
        .map((f: { properties: { headline: string; severity: string; description: string } }) => ({
          headline: f.properties.headline,
          severity: f.properties.severity,
          description: f.properties.description?.slice(0, 300) || "",
        }));
    }

    // Build 3-day forecast
    let upcoming: { name: string; temperature: number; shortForecast: string; isDaytime: boolean }[] = [];
    if (forecastRes.ok) {
      const fData = await forecastRes.json().catch(() => null);
      if (!fData) {
        // Already consumed above, re-fetch
      }
    }

    return NextResponse.json({
      current: current
        ? { ...current }
        : forecast
          ? { temp: forecast.temperature, humidity: forecast.humidity, windSpeed: forecast.windSpeed, description: forecast.shortForecast }
          : null,
      forecast: forecast
        ? { shortForecast: forecast.shortForecast, detailedForecast: forecast.detailedForecast, isDaytime: forecast.isDaytime }
        : null,
      alerts,
    });
  } catch (err) {
    console.error("[weather] Failed:", err);
    return NextResponse.json({ current: null, forecast: null, alerts: [] });
  }
}
