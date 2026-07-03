/**
 * Treasure Haul brand-Page post cleanup.
 *
 * When a product sells, Ruthann removes it from FB Marketplace — but the
 * promotional post we published to her "Ruthann's Treasure Haul" brand Page
 * (facebook.com/RuthannsTreasureHaul) lingers, so followers keep seeing
 * already-sold items. This module deletes that Page post and stamps the
 * deletion so the work is idempotent.
 *
 * Post IDs live on `Product.postizPostIds.treasureHaulPage` and are written by
 * the daily poster (app/api/cron/treasure-haul-daily). We add a `deletedAt`
 * marker to that same blob once the post is removed so re-running the sweep is
 * a no-op.
 *
 * CAROUSELS: the daily poster groups 3-5 products into ONE post, so multiple
 * products share a single `treasureHaulPage.id`. We must NOT delete such a post
 * just because one of its items sold — the others may still be listed and the
 * post is still legitimately advertising them. Policy: delete a post only when
 * EVERY product that references it is sold. Mixed posts are left in place and
 * get cleaned automatically once their last live item sells.
 */

import { prisma } from "@/lib/prisma";
import {
  FB_PAGES,
  TREASURE_HAUL_PAGE_ID,
  deletePost,
  getPageToken,
} from "@/lib/facebook";
import type { Prisma } from "@prisma/client";

interface TreasureHaulBlob {
  id?: string;
  url?: string;
  postedAt?: string;
  /** ISO timestamp set once the Page post has been deleted. */
  deletedAt?: string;
}

/** Read the treasureHaulPage sub-object off a product's postizPostIds blob. */
function readTreasureHaulBlob(postizPostIds: unknown): {
  base: Record<string, unknown>;
  th: TreasureHaulBlob | null;
} {
  const base =
    postizPostIds &&
    typeof postizPostIds === "object" &&
    !Array.isArray(postizPostIds)
      ? (postizPostIds as Record<string, unknown>)
      : {};
  const raw = base.treasureHaulPage;
  const th =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as TreasureHaulBlob)
      : null;
  return { base, th };
}

function treasureHaulToken(): string | null {
  const page = FB_PAGES.find((p) => p.id === TREASURE_HAUL_PAGE_ID);
  return page ? getPageToken(page) : null;
}

/** Stamp deletedAt on one product's treasureHaulPage blob, preserving siblings. */
async function stampDeleted(
  productId: string,
  postizPostIds: unknown,
  th: TreasureHaulBlob,
  when: string,
): Promise<void> {
  const { base } = readTreasureHaulBlob(postizPostIds);
  const merged: Record<string, unknown> = {
    ...base,
    treasureHaulPage: { ...th, deletedAt: when },
  };
  await prisma.product.update({
    where: { id: productId },
    data: { postizPostIds: merged as Prisma.InputJsonValue },
  });
}

export type CleanupOutcome =
  | "deleted"
  | "already-deleted"
  | "has-active"
  | "no-post"
  | "no-token"
  | "error";

/**
 * Delete a Treasure Haul Page post by id, but ONLY if every product that
 * references it is sold. Stamps deletedAt on all referencing products so the
 * sweep treats them as done. A 404 from FB (already gone) counts as success.
 * Best-effort — never throws.
 */
export async function deleteTreasureHaulPostIfFullySold(
  postId: string,
  token: string,
): Promise<{ outcome: CleanupOutcome; productCount?: number; error?: string }> {
  // All products that reference this exact Page post id.
  const refs = await prisma.product.findMany({
    where: {
      postizPostIds: {
        path: ["treasureHaulPage", "id"],
        equals: postId,
      },
    },
    select: { id: true, status: true, postizPostIds: true },
  });

  if (refs.length === 0) return { outcome: "no-post" };

  // Already cleaned? (every ref stamped deletedAt)
  const undeleted = refs.filter((r) => {
    const { th } = readTreasureHaulBlob(r.postizPostIds);
    return th?.id && !th.deletedAt;
  });
  if (undeleted.length === 0) {
    return { outcome: "already-deleted", productCount: refs.length };
  }

  // Carousel guard: any still-live product keeps the post alive.
  const hasActive = refs.some((r) => r.status !== "sold");
  if (hasActive) return { outcome: "has-active", productCount: refs.length };

  try {
    await deletePost(postId, token); // treats 404 as success
  } catch (err) {
    return {
      outcome: "error",
      productCount: refs.length,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const when = new Date().toISOString();
  for (const r of undeleted) {
    const { th } = readTreasureHaulBlob(r.postizPostIds);
    if (th) await stampDeleted(r.id, r.postizPostIds, th, when);
  }

  return { outcome: "deleted", productCount: refs.length };
}

/**
 * Remove the Treasure Haul Page post for a single (just-sold) product, if any.
 * Delegates to the post-id-level routine so carousels are handled correctly:
 * the post is only deleted once all of its products are sold. Idempotent and
 * best-effort.
 */
export async function removeTreasureHaulPost(
  productId: string,
  opts?: { token?: string | null },
): Promise<{ outcome: CleanupOutcome; postId?: string; error?: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, postizPostIds: true },
  });
  if (!product) return { outcome: "no-post" };

  const { th } = readTreasureHaulBlob(product.postizPostIds);
  if (!th?.id) return { outcome: "no-post" };
  if (th.deletedAt) return { outcome: "already-deleted", postId: th.id };

  const token = opts?.token ?? treasureHaulToken();
  if (!token) return { outcome: "no-token", postId: th.id };

  const r = await deleteTreasureHaulPostIfFullySold(th.id, token);
  return { outcome: r.outcome, postId: th.id, error: r.error };
}

export interface SweepResult {
  postsScanned: number;
  postsDeleted: number;
  postsHeldActive: number;
  errors: number;
  noToken: boolean;
}

/**
 * Safety-net sweep: find Page posts whose products are ALL sold and remove
 * each one. Catches sold transitions from every code path (mirror absence-sold,
 * explicit FB "sold" badge, admin manual "mark sold"), not just the mirror.
 * Mixed carousels (some items still live) are counted as "held" and skipped.
 */
export async function sweepSoldTreasureHaulPosts(
  limit = 300,
): Promise<SweepResult> {
  const token = treasureHaulToken();
  const result: SweepResult = {
    postsScanned: 0,
    postsDeleted: 0,
    postsHeldActive: 0,
    errors: 0,
    noToken: false,
  };
  if (!token) {
    result.noToken = true;
    return result;
  }

  // Recently-sold products that still carry an un-deleted Page post. Collect
  // their distinct post ids; each is evaluated once at the post level.
  const candidates = await prisma.product.findMany({
    where: { status: "sold" },
    select: { id: true, postizPostIds: true },
    orderBy: { soldAt: "desc" },
    take: limit,
  });

  const postIds = new Set<string>();
  for (const c of candidates) {
    const { th } = readTreasureHaulBlob(c.postizPostIds);
    if (th?.id && !th.deletedAt) postIds.add(th.id);
  }

  for (const postId of postIds) {
    result.postsScanned++;
    const r = await deleteTreasureHaulPostIfFullySold(postId, token);
    if (r.outcome === "deleted") result.postsDeleted++;
    else if (r.outcome === "has-active") result.postsHeldActive++;
    else if (r.outcome === "error") result.errors++;
  }

  return result;
}
