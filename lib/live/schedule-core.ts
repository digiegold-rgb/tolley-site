import { z } from "zod";
export const WHATNOT_SELLER_ID = "72629607"; // treasure_hauls, verified against its public profile and Seller Hub
export const SCHEDULE_PREFIX = "whatnot_";
export const SCHEDULE_LEASE_MS = 6 * 3600000;
const node = z.object({
  id: z.uuid(), title: z.string().trim().min(3).max(120), startTime: z.number().int().positive(),
  userId: z.literal(WHATNOT_SELLER_ID), status: z.literal("CREATED"),
  isHiddenBySeller: z.boolean(), minEligibleLoyaltyTier: z.unknown().refine(v => v !== undefined),
});
const responseSchema = z.object({
  errors: z.array(z.unknown()).max(0).optional(),
  data: z.object({ upcomingLives: z.object({
    edges: z.array(z.object({ node })).max(50),
    pageInfo: z.object({ hasNextPage: z.literal(false) }),
  }) }),
});
/** Only a complete, authenticated, account-matched snapshot can remove a show. */
export function parseWhatnotSchedule(value: unknown, sellerId: unknown, now = new Date()) {
  if (sellerId !== WHATNOT_SELLER_ID) throw new Error("Whatnot seller identity mismatch");
  const nodes = responseSchema.parse(value).data.upcomingLives.edges.map(e => e.node);
  if (new Set(nodes.map(n => n.id)).size !== nodes.length) throw new Error("Duplicate Whatnot show IDs");
  return nodes.filter(n => !n.isHiddenBySeller && n.minEligibleLoyaltyTier === null && n.startTime > now.getTime()).map(n => ({
    id: `${SCHEDULE_PREFIX}${n.id}`, title: n.title, startsAt: new Date(n.startTime),
    whatnotUrl: `https://www.whatnot.com/live/${n.id}`,
  }));
}
export type ObservedShow = ReturnType<typeof parseWhatnotSchedule>[number];
