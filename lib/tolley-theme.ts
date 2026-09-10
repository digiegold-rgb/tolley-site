/** Public Tolley surfaces share one theme. Product apps, partner brands, and
 * operational routes deliberately do not inherit it. Add new services here. */
export const TOLLEY_CORE_ROUTES = ["/", "/about", "/start", "/privacy", "/terms", "/security", "/data-retention", "/advertising"];
export const TOLLEY_SERVICE_ROOTS = ["wd", "pools", "homes", "housing", "trailer", "generator", "hvac", "lastmile", "moving", "rental", "tables", "picnic-table", "kerplunk", "estate", "cleanouts", "shop", "drive", "sales", "real-estate-agent"];
const OPERATIONAL_SEGMENTS = new Set(["admin", "dashboard", "driver", "portal", "analytics", "new", "whatsapp"]);

export function tolleyThemeForPath(pathname: string | null) {
  if (!pathname) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (TOLLEY_CORE_ROUTES.includes(path)) return { kind: "core", service: "" } as const;
  const segments = path.split("/").filter(Boolean);
  if (!TOLLEY_SERVICE_ROOTS.includes(segments[0]) || segments.slice(1).some(segment => OPERATIONAL_SEGMENTS.has(segment))) return null;
  return { kind: "service", service: segments[0] } as const;
}
