// City rank tracker config — the 33 "New KC Homes Today" cities.
//
// One-time copy of ~/housing-hub/cities.json labels (2026-08-11). If a city is
// added to the video pipeline, add it here too — the tracker only watches what
// is listed.
//
// Budget: 33 cities × 2 engines = 66 SerpAPI calls per monthly sweep, funded
// by the "city-rank-track" row in MONTHLY_CAPS (lib/serpapi.ts).

export interface TrackedCity {
  city: string;
  st: "MO" | "KS";
}

export const TRACKED_CITIES: TrackedCity[] = [
  { city: "Independence", st: "MO" },
  { city: "Blue Springs", st: "MO" },
  { city: "Lee's Summit", st: "MO" },
  { city: "Prairie Village", st: "KS" },
  { city: "Leawood", st: "KS" },
  { city: "North Kansas City", st: "MO" },
  { city: "Liberty", st: "MO" },
  { city: "Overland Park", st: "KS" },
  { city: "Olathe", st: "KS" },
  { city: "Shawnee", st: "KS" },
  { city: "Lenexa", st: "KS" },
  { city: "Raymore", st: "MO" },
  { city: "Gladstone", st: "MO" },
  { city: "Kansas City", st: "MO" },
  { city: "Kansas City", st: "KS" },
  { city: "Gardner", st: "KS" },
  { city: "Leavenworth", st: "KS" },
  { city: "Raytown", st: "MO" },
  { city: "Belton", st: "MO" },
  { city: "Kearney", st: "MO" },
  { city: "Grain Valley", st: "MO" },
  { city: "Smithville", st: "MO" },
  { city: "Parkville", st: "MO" },
  { city: "Grandview", st: "MO" },
  { city: "Spring Hill", st: "KS" },
  { city: "Lone Jack", st: "MO" },
  { city: "Basehor", st: "KS" },
  { city: "Oak Grove", st: "MO" },
  { city: "Peculiar", st: "MO" },
  { city: "Platte City", st: "MO" },
  { city: "Harrisonville", st: "MO" },
  { city: "Excelsior Springs", st: "MO" },
  { city: "Bonner Springs", st: "KS" },
];

export function googleQuery(c: TrackedCity): string {
  return `new homes ${c.city} ${c.st}`;
}

export function youtubeQuery(c: TrackedCity): string {
  return `${c.city} ${c.st} new homes`;
}

// What counts as "us" in a result. Google organic: tolley.io or a youtube
// result on our channel. YouTube engine: our channel name on the video row.
export const OUR_DOMAINS = ["tolley.io"];
export const OUR_CHANNEL_HANDLES = ["yourkchome", "your kc homes"];

export function isOurGoogleResult(link: string, title: string): boolean {
  const l = (link || "").toLowerCase();
  if (OUR_DOMAINS.some((d) => l.includes(d))) return true;
  if (l.includes("youtube.com") || l.includes("youtu.be")) {
    const t = (title || "").toLowerCase();
    return OUR_CHANNEL_HANDLES.some((h) => t.includes(h)) || l.includes("yourkchome");
  }
  return false;
}

export function isOurYoutubeResult(channelName: string, link: string): boolean {
  const c = (channelName || "").toLowerCase();
  const l = (link || "").toLowerCase();
  return OUR_CHANNEL_HANDLES.some((h) => c.includes(h)) || l.includes("yourkchome");
}
