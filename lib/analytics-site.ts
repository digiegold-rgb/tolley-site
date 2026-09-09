import { SUBSITES } from "@/lib/subsites";

const extraSites = ["clean", "fit", "manus", "hq", "account", "settings"];

/** One classification shared by the sole root pageview tracker. */
export function analyticsSiteForPath(pathname: string): string | null {
  if (["/api", "/admin", "/_next", "/login", "/logout", "/reset-password"].some(
    prefix => pathname === prefix || pathname.startsWith(prefix + "/"),
  )) return null;
  const sites = [...SUBSITES.map(s => ({ path: s.url, name: s.name })),
    ...extraSites.map(name => ({ path: `/${name}`, name }))];
  return sites.filter(s => pathname === s.path || pathname.startsWith(s.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0]?.name ?? "home";
}
