/** Keep operational manifests available without advertising them as products. */
export const UNPROMOTED_SUBSITES = new Set([
  "advertising", "water", "video", "vater", "scan", "agents", "circle",
  "real-estate-agent",
]);

export type RouteSearchParams = Record<string, string | string[] | undefined>;

/** Preserve campaign tags and repeated query parameters through page redirects. */
export function routeDestination(path: string, search: RouteSearchParams): string {
  const url = new URL(path, "https://www.tolley.io");
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    url.searchParams.delete(key);
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
