/**
 * /animate video, script, and generation screens.
 *
 * Force Kill belongs in the sticky header here whenever a project is selected.
 * `selectedProjectId` is kept when moving among these routes so the header
 * still has a target. It is cleared when leaving for pricing / course / rules /
 * team / listing / etc.
 *
 * Not listed: pricing, course, rules, team, api-keys, listing, dashboard,
 * voices, feeds, and every other account/chrome screen.
 */
export const ANIMATE_GENERATION_ROUTES = new Set<string>([
  "create",
  "progress",
  "queue",
  "library",
  "editor",
  "video-editor",
  "script-review",
  "animation",
  "autopilot",
  "recent",
]);

export function isAnimateGenerationRoute(route: string): boolean {
  return ANIMATE_GENERATION_ROUTES.has(route);
}
