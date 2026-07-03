import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { genreNames } from "@/app/tv/genres";

export const dynamic = "force-dynamic";

const OVERSEERR_URL = process.env.OVERSEERR_URL || "https://tv-api.tolley.io";

// Server-side proxy to Overseerr's TMDB discover API, scoped to a year and
// ranked. The Overseerr API key never reaches the browser.
export async function GET(req: Request) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.OVERSEERR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OVERSEERR_API_KEY not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "tv" ? "tv" : "movie";
  const year = parseInt(searchParams.get("year") || "", 10);
  const rank = searchParams.get("rank") || "notable";
  if (!year || year < 1900 || year > 2100) {
    return NextResponse.json({ error: "valid year required" }, { status: 400 });
  }

  // Build Overseerr discover query: sort + a vote floor + the year window.
  const params = new URLSearchParams({ page: "1" });
  if (rank === "rated") {
    params.set("sortBy", "vote_average.desc");
    params.set("voteCountGte", type === "tv" ? "100" : "300"); // keep it mainstream, not obscure 10/10s
  } else if (rank === "boxoffice") {
    // Revenue is movies-only; TV falls back to trending popularity.
    params.set("sortBy", type === "tv" ? "popularity.desc" : "revenue.desc");
  } else {
    params.set("sortBy", "vote_count.desc"); // notable / most-rated
  }
  if (type === "tv") {
    params.set("firstAirDateGte", `${year}-01-01`);
    params.set("firstAirDateLte", `${year}-12-31`);
  } else {
    params.set("primaryReleaseDateGte", `${year}-01-01`);
    params.set("primaryReleaseDateLte", `${year}-12-31`);
  }

  try {
    const r = await fetch(`${OVERSEERR_URL}/api/v1/discover/${type === "tv" ? "tv" : "movies"}?${params}`, {
      headers: { "X-Api-Key": key },
      cache: "no-store",
    });
    if (!r.ok) {
      const body = await r.text();
      return NextResponse.json(
        { error: `Discover failed (${r.status})`, detail: body.slice(0, 300) },
        { status: 502 }
      );
    }
    const data = await r.json();
    const results = (data.results || [])
      .filter((m: any) => (m.posterPath || m.title || m.name))
      .slice(0, 20)
      .map((m: any) => ({
        id: m.id,
        mediaType: type,
        title: m.title || m.name,
        year: (m.releaseDate || m.firstAirDate || `${year}`).slice(0, 4),
        overview: m.overview || "",
        poster: m.posterPath ? `https://image.tmdb.org/t/p/w342${m.posterPath}` : null,
        backdrop: m.backdropPath ? `https://image.tmdb.org/t/p/w780${m.backdropPath}` : null,
        rating: m.voteAverage || 0,
        genres: genreNames(m.genreIds, type),
        status: m.mediaInfo?.status ?? 0,
      }));
    return NextResponse.json({ year, type, rank, results });
  } catch (e: any) {
    return NextResponse.json({ error: "proxy error", detail: String(e?.message || e) }, { status: 502 });
  }
}
