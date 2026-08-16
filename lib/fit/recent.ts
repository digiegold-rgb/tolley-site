/**
 * Recent persona fits — published by the DGX after each render
 * (growth-engine/scripts/publish-recent-fits.mjs -> Vercel Blob). Read at
 * request time so the lookbook shows "her last 30 looks" with a thumbnail and
 * a link to that video's fit page. Missing/unreachable = empty list, never a
 * broken page.
 */
export interface RecentFit {
  code: string;
  title: string;
  lane: "treasure" | "wd" | "housing" | "estate" | string;
  date: string;       // YYYY-MM-DD
  thumb?: string | null;
  outfit?: string;
}

const RECENT_URL =
  process.env.PERSONA_FITS_RECENT_URL ||
  "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/persona-fits/recent.json";

export async function recentFits(limit = 30): Promise<RecentFit[]> {
  try {
    const res = await fetch(RECENT_URL, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const j = (await res.json()) as { fits?: RecentFit[] };
    return Array.isArray(j.fits) ? j.fits.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export const LANE_LABEL: Record<string, string> = {
  treasure: "Treasure Haul", wd: "Washer & Dryer", housing: "KC Housing", estate: "Estate Sales",
};
