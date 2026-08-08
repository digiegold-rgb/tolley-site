/**
 * Shared constants for the vater-scoped YouTube OAuth round trip.
 *
 * These live outside the route files on purpose: Next.js only allows the
 * handler exports (GET/POST/runtime/dynamic/…) from a `route.ts`, so /start
 * and /callback cannot import the cookie name from each other.
 */

/** CSRF state cookie. Distinct name from the social suite's `yt_oauth_state`
 *  so a studio consent and an admin consent can never read each other's. */
export const OAUTH_STATE_COOKIE = "vater_yt_oauth_state";

/**
 * Cookie path — scoped to this flow only.
 *
 * Note the segment order: `.../social-accounts/oauth/youtube`, mirroring the
 * social suite's `/api/social/oauth/youtube/*`. It canNOT live at
 * `.../social-accounts/youtube/oauth`, because a static `youtube/` directory
 * there would shadow the sibling `[platform]` route that the social-accounts
 * manager uses to disconnect a platform.
 */
export const OAUTH_COOKIE_PATH = "/api/vater/social-accounts/oauth/youtube";

/** Where the callback page sends the user when it's done. */
export const OAUTH_RETURN_TO = "/animate#r=script-review";
