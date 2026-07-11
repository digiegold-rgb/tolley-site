// Supported social platforms for the vater/youtube share feature.
// Lives in lib (not the route.ts) because a Next route file may only export
// HTTP methods + segment config — an extra export corrupts the production bundle.

export const SUPPORTED_PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
  "twitter",
  "linkedin",
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export function isSupportedPlatform(p: string): p is SupportedPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(p);
}
