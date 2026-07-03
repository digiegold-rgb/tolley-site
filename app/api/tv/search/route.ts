import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { genreNames } from "@/app/tv/genres";

export const dynamic = "force-dynamic";

const OVERSEERR_URL = process.env.OVERSEERR_URL || "https://tv-api.tolley.io";

// Server-side proxy to Overseerr search. The Overseerr API key never reaches
// the browser — it is injected here after the admin gate passes.
export async function GET(req: Request) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.OVERSEERR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OVERSEERR_API_KEY not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").trim();
  const page = searchParams.get("page") || "1";
  if (!query) return NextResponse.json({ results: [], page: 1, totalPages: 0, totalResults: 0 });

  try {
    const r = await fetch(
      `${OVERSEERR_URL}/api/v1/search?query=${encodeURIComponent(query)}&page=${encodeURIComponent(page)}`,
      { headers: { "X-Api-Key": key }, cache: "no-store" }
    );
    if (!r.ok) {
      const body = await r.text();
      return NextResponse.json(
        { error: `Overseerr search failed (${r.status})`, detail: body.slice(0, 300) },
        { status: 502 }
      );
    }
    const data = await r.json();
    // Trim to only what the UI needs, keep movies + tv only.
    const results = (data.results || [])
      .filter((m: any) => m.mediaType === "movie" || m.mediaType === "tv")
      .map((m: any) => ({
        id: m.id,
        mediaType: m.mediaType,
        title: m.title || m.name,
        year: (m.releaseDate || m.firstAirDate || "").slice(0, 4),
        overview: m.overview || "",
        poster: m.posterPath ? `https://image.tmdb.org/t/p/w342${m.posterPath}` : null,
        backdrop: m.backdropPath ? `https://image.tmdb.org/t/p/w780${m.backdropPath}` : null,
        rating: m.voteAverage || 0,
        genres: genreNames(m.genreIds, m.mediaType),
        status: m.mediaInfo?.status ?? 0, // 5=available, 4=partial, 3=processing, 2=pending
      }));
    return NextResponse.json({
      page: data.page,
      totalPages: data.totalPages,
      totalResults: data.totalResults,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "proxy error", detail: String(e?.message || e) }, { status: 502 });
  }
}
