/**
 * lib/leads/digest-subscribers.ts
 *
 * KC Motivated-Seller Brief — subscriber list.
 *
 * v1 is hardcoded. When the list reaches 5+ paying agents, migrate this to a
 * Prisma model with a `/leads/admin/digest-subscribers` UI. For now this file
 * IS the database — edit and redeploy when a new agent says yes.
 *
 * To add a subscriber:
 *   1. Get the agent's email + farm-area zip codes (3–7 ZIPs typical).
 *   2. Add an entry below.
 *   3. Send them their Stripe Payment Link separately.
 *   4. Commit + deploy.
 *
 * Status legend:
 *   "active"   — paying ($199 founding / $299 standard)
 *   "trial"    — 14-day free trial, send anyway, mention trial in subject
 *   "paused"   — keep config, skip sending (used during refunds / disputes)
 */

export type DigestSubscriberStatus = "active" | "trial" | "paused";

export interface DigestSubscriber {
  /** Stable id — used in unsubscribe links and email logs */
  id: string;
  name: string;
  email: string;
  /** 3–7 zip codes for KC metro farm. Cron filters listings by this list. */
  farmZips: string[];
  status: DigestSubscriberStatus;
  /** Optional override for the outreach script template. Falls back to default. */
  customScriptTemplate?: string;
  /** ISO date when they signed up. Useful for "founding member" tracking. */
  joinedAt: string;
}

export const DIGEST_SUBSCRIBERS: DigestSubscriber[] = [
  // Subscriber #1 — Cordless himself, for end-to-end testing of the Monday flow.
  // He sees his own digest first thing Monday before any paying agent does.
  {
    id: "cordless-self",
    name: "Jared Tolley",
    email: "digiegold@gmail.com",
    farmZips: ["64052", "64055", "64056", "64057", "64014"],
    status: "active",
    joinedAt: "2026-05-05",
  },
];

export function activeSubscribers(): DigestSubscriber[] {
  return DIGEST_SUBSCRIBERS.filter(
    (s) => s.status === "active" || s.status === "trial",
  );
}
