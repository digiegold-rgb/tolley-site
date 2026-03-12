/**
 * Platform adapter registry.
 *
 * Import and register all platform adapters here.
 * getAdapter() returns the appropriate adapter for a given platform.
 */

import type { PlatformAdapter, PlatformType } from "../types";
import { linkedinAdapter } from "./linkedin";
import { twitterAdapter } from "./twitter";

const adapters: Partial<Record<PlatformType, PlatformAdapter>> = {
  linkedin: linkedinAdapter,
  twitter: twitterAdapter,
  // Phase 2: facebook, instagram, youtube, tiktok
};

export function getAdapter(platform: PlatformType): PlatformAdapter | null {
  return adapters[platform] || null;
}

export function getAvailablePlatforms(): PlatformType[] {
  return Object.keys(adapters) as PlatformType[];
}
