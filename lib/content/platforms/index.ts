/**
 * Platform adapter registry.
 *
 * Import and register all platform adapters here.
 * getAdapter() returns the appropriate adapter for a given platform.
 */

import type { PlatformAdapter, PlatformType } from "../types";
import { facebookAdapter } from "./facebook";
import { linkedinAdapter } from "./linkedin";
import { twitterAdapter } from "./twitter";

const adapters: Partial<Record<PlatformType, PlatformAdapter>> = {
  linkedin: linkedinAdapter,
  twitter: twitterAdapter,
  facebook: facebookAdapter,
  // Phase 2: instagram, youtube, tiktok (handled by content-autopilot publishers)
};

export function getAdapter(platform: PlatformType): PlatformAdapter | null {
  return adapters[platform] || null;
}

export function getAvailablePlatforms(): PlatformType[] {
  return Object.keys(adapters) as PlatformType[];
}
