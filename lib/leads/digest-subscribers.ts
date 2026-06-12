/**
 * lib/leads/digest-subscribers.ts
 *
 * KC Motivated-Seller Brief — subscriber list.
 *
 * v2: DB-backed. Rows live in the Prisma DigestSubscriber model, created by
 * the self-serve signup at /leads/digest (POST /api/leads/digest/subscribe →
 * Stripe checkout → webhook flips status to "active"). The hardcoded v1 array
 * that used to live here was migrated as the founding row "cordless-self" in
 * prisma/migrations/20260612_digest_subscriber.
 *
 * Status legend:
 *   "pending"  — signed up, checkout not completed yet (never emailed)
 *   "active"   — paying ($199 founding / $299 standard)
 *   "trial"    — comped/trial, send anyway, mention trial in subject
 *   "paused"   — keep config, skip sending (unsubscribe link / past_due)
 *   "canceled" — Stripe subscription ended
 */

import { prisma } from "@/lib/prisma";

export type DigestSubscriberStatus =
  | "pending"
  | "active"
  | "trial"
  | "paused"
  | "canceled";

export interface DigestSubscriber {
  /** Stable id — used in unsubscribe links and email logs */
  id: string;
  name: string;
  email: string;
  /** 1–7 zip codes for KC metro farm. Cron filters listings by this list. */
  farmZips: string[];
  status: DigestSubscriberStatus;
  /** Optional override for the outreach script template. Falls back to default. */
  customScriptTemplate?: string;
  /** ISO date when they signed up. Useful for "founding member" tracking. */
  joinedAt: string;
  /** Token for the one-click pause link in the email footer. */
  unsubscribeToken?: string;
}

/** Everyone who should receive the Monday digest (status active or trial). */
export async function activeSubscribers(): Promise<DigestSubscriber[]> {
  const rows = await prisma.digestSubscriber.findMany({
    where: { status: { in: ["active", "trial"] } },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      farmZips: true,
      status: true,
      customScriptTemplate: true,
      joinedAt: true,
      unsubscribeToken: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    farmZips: r.farmZips,
    status: r.status as DigestSubscriberStatus,
    customScriptTemplate: r.customScriptTemplate ?? undefined,
    joinedAt: r.joinedAt.toISOString(),
    unsubscribeToken: r.unsubscribeToken,
  }));
}
