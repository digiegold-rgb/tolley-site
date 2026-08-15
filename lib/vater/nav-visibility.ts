/**
 * Jelly Studio (/animate) nav visibility — pure, isomorphic data.
 *
 * This module is imported by BOTH the client Sidebar/Shell and the
 * /api/vater/me route handler, so it must stay free of `server-only`,
 * prisma, next/headers, and anything else that can't run in the browser.
 *
 * Tier meaning (mirrors lib/admin-auth.ts):
 *   public — any signed-in customer. Golden path only: make a video, watch
 *            it render, publish it, pay for it.
 *   studio — isVaterStudioEmail(): the full production studio (script
 *            review, Direct dictation lane, Course Studio, Rules).
 *   owner  — isVaterAdminEmail() / isAdminEmail(): ops surfaces that touch
 *            the owner's own accounts (RSS feeds, autopilot, Discord bot).
 *
 * Anything NOT listed here (editor, styles-edit, custom-art-styles, …) is
 * reachable by everyone — those are sub-routes of a nav entry that already
 * carries the gate.
 */

export type VaterTier = 'public' | 'studio' | 'owner';

const TIER_RANK: Record<VaterTier, number> = {
  public: 0,
  studio: 1,
  owner: 2,
};

export interface NavRouteDef {
  id: string;
  label: string;
  /** Matches IconName in components/animate/Icon.tsx. */
  icon: string;
  minTier: VaterTier;
  section: 'primary' | 'secondary';
  /** Hidden unless NEXT_PUBLIC_VATER_BETA_STUBS === '1'. */
  stub?: boolean;
}

export const NAV_ROUTES: readonly NavRouteDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', minTier: 'public', section: 'primary' },
  { id: 'direct', label: 'Direct', icon: 'sparkle', minTier: 'studio', section: 'primary' },
  { id: 'script-review', label: 'Script Review', icon: 'scriptReview', minTier: 'studio', section: 'primary' },
  { id: 'library', label: 'Library', icon: 'videoEditor', minTier: 'public', section: 'primary' },
  { id: 'queue', label: 'Queue', icon: 'history', minTier: 'public', section: 'primary' },
  { id: 'recent', label: 'Recent', icon: 'sparkle', minTier: 'public', section: 'primary' },
  { id: 'voices', label: 'Voices', icon: 'mic', minTier: 'public', section: 'primary' },
  { id: 'feeds', label: 'RSS Feeds', icon: 'web', minTier: 'owner', section: 'primary' },
  { id: 'autopilot', label: 'Autopilot', icon: 'sparkle', minTier: 'owner', section: 'primary' },
  { id: 'publishing', label: 'Publishing', icon: 'upload', minTier: 'public', section: 'primary' },
  { id: 'animation', label: 'AI Animation', icon: 'image', minTier: 'studio', section: 'primary', stub: true },
  { id: 'analytics', label: 'Analytics', icon: 'niche', minTier: 'public', section: 'primary', stub: true },
  { id: 'niche-finder', label: 'Creator Models', icon: 'search', minTier: 'public', section: 'primary' },
  { id: 'styles', label: 'Styles', icon: 'styles', minTier: 'public', section: 'primary' },
  { id: 'project-history', label: 'Project History', icon: 'history', minTier: 'public', section: 'primary' },
  { id: 'video-editor', label: 'Video Editor', icon: 'videoEditor', minTier: 'public', section: 'primary' },
  { id: 'course', label: 'Course Studio', icon: 'course', minTier: 'studio', section: 'primary' },
  { id: 'rules', label: 'Rules', icon: 'description', minTier: 'studio', section: 'primary' },
  { id: 'learning-center', label: 'Learning Center', icon: 'learning', minTier: 'public', section: 'primary', stub: true },
  { id: 'pricing', label: 'Billing', icon: 'affiliate', minTier: 'public', section: 'secondary' },
  { id: 'discord', label: 'Discord Bot', icon: 'help', minTier: 'owner', section: 'secondary' },
  { id: 'affiliate', label: 'Affiliate', icon: 'affiliate', minTier: 'public', section: 'secondary', stub: true },
];

/** True when `tier` is at least `minTier`. */
export function tierAtLeast(tier: VaterTier, minTier: VaterTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minTier];
}

/** Nav entries this tier should see, in declaration order. */
export function visibleRoutes(tier: VaterTier, showStubs: boolean): NavRouteDef[] {
  return NAV_ROUTES.filter(
    (r) => tierAtLeast(tier, r.minTier) && (showStubs || !r.stub),
  );
}

/**
 * Route-level gate used by Shell.renderScreen.
 *
 * Unknown ids return TRUE on purpose: sub-routes like `editor`,
 * `styles-edit`, `styles-list`, `custom-art-styles` and the legacy `studio`
 * alias are not nav entries but must stay reachable. Adding a gate for them
 * means adding them to NAV_ROUTES.
 */
export function canSeeRoute(tier: VaterTier, id: string): boolean {
  const def = NAV_ROUTES.find((r) => r.id === id);
  if (!def) return true;
  return tierAtLeast(tier, def.minTier);
}

/** Flat list of route ids for the /api/vater/me payload. */
export function routeIdsForTier(tier: VaterTier, showStubs = true): string[] {
  return visibleRoutes(tier, showStubs).map((r) => r.id);
}
