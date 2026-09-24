/** Public sites retired at the owner's request on 2026-09-14.
 *  /cleanouts was put back on 2026-09-24; quote requests were still arriving.
 */
export const RETIRED_SITE_PATHS = [
  "/kerplunk", "/picnic-table", "/tables", "/moving", "/moving-supplies",
  "/biz/home-essentials-box",
  "/moupins", "/junkinjays", "/lastmile", "/drive", "/e-and-t",
] as const;

export function isRetiredSitePath(pathname: string): boolean {
  return RETIRED_SITE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
