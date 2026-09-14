/** Public sites retired at the owner's request on 2026-09-14. */
export const RETIRED_SITE_PATHS = [
  "/moupins", "/junkinjays", "/lastmile", "/drive", "/cleanouts", "/e-and-t",
] as const;

export function isRetiredSitePath(pathname: string): boolean {
  return RETIRED_SITE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
