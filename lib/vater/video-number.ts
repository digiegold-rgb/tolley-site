/**
 * lib/vater/video-number.ts
 *
 * Library video numbering (Trey 2026-08-12: "number all the videos going
 * forward ... so I can reference them easily").
 *
 * Every youtube-lane project carries a permanent number prefix on its
 * sourceTitle (the field every library surface renders first). Numbers are
 * per-owner, assigned oldest-first, and NEVER change or get reused once
 * given — they are how Trey references videos in reviews, so renumbering
 * would corrupt his past feedback. New rows are numbered lazily by
 * ensureVideoNumbers() on library fetch, which covers every creation path
 * (site routes, RSS cron, headless DGX scripts) without touching each one.
 *
 * Owned rows are "#N — Title". Legacy ownerless rows (pre-multi-tenancy,
 * the old RSS/links lane) are "#LN — Title": studio admins see both groups
 * merged in one library view, so the two sequences must not collide.
 */

import { prisma } from "@/lib/prisma";

const OWNED_RE = /^#(\d+)\s*(?:[—–-]\s*)?/;
const LEGACY_RE = /^#L(\d+)\s*(?:[—–-]\s*)?/i;

export function parseVideoNumber(
  title: string | null | undefined,
  legacy = false,
): number | null {
  const m = (legacy ? LEGACY_RE : OWNED_RE).exec(title ?? "");
  return m ? parseInt(m[1], 10) : null;
}

interface NumberableProject {
  id: string;
  userId: string | null;
  sourceTitle: string | null;
  topic: string | null;
  mode: string;
  sourceUrl: string | null;
  createdAt: Date;
}

/** Mirrors the library card's title fallback chain. */
function displayTitle(p: NumberableProject): string {
  return (
    p.sourceTitle ??
    (p.mode === "topic" && p.topic ? p.topic : null) ??
    p.sourceUrl ??
    p.id
  );
}

/**
 * Assign number prefixes to any unnumbered projects, per owner, oldest
 * first. Mutates the passed rows in place (so the response that triggered
 * the sweep already shows the numbers) and persists to the DB. Idempotent;
 * existing numbers are never altered.
 */
export async function ensureVideoNumbers<T extends NumberableProject>(
  projects: T[],
): Promise<T[]> {
  const byOwner = new Map<string, T[]>();
  for (const p of projects) {
    const key = p.userId ?? "__legacy__";
    const group = byOwner.get(key);
    if (group) group.push(p);
    else byOwner.set(key, [p]);
  }

  const updates: { id: string; sourceTitle: string }[] = [];
  const highWater: { owner: string; max: number }[] = [];
  for (const [owner, group] of byOwner.entries()) {
    const legacy = owner === "__legacy__";
    const prefix = legacy ? "#L" : "#";
    let max = 0;
    for (const p of group) {
      const n = parseVideoNumber(p.sourceTitle, legacy);
      if (n !== null && n > max) max = n;
    }
    // Never reuse a number: a deleted #52 must not make the next row #52
    // again (Trey's review notes reference numbers). The per-owner
    // high-water mark lives on VaterAccount.videoNumberMax.
    if (!legacy) {
      const acct = await prisma.vaterAccount.findUnique({
        where: { userId: owner },
        select: { videoNumberMax: true },
      });
      if (acct && acct.videoNumberMax > max) max = acct.videoNumberMax;
    }
    const startMax = max;
    const unnumbered = group
      .filter((p) => parseVideoNumber(p.sourceTitle, legacy) === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const p of unnumbered) {
      max += 1;
      const titled = `${prefix}${max} — ${displayTitle(p)}`;
      p.sourceTitle = titled;
      updates.push({ id: p.id, sourceTitle: titled });
    }
    if (!legacy && max > startMax) highWater.push({ owner, max });
  }

  if (updates.length > 0) {
    await prisma.$transaction([
      ...updates.map((u) =>
        prisma.youTubeProject.update({
          where: { id: u.id },
          data: { sourceTitle: u.sourceTitle },
        }),
      ),
      // Advance each owner's high-water mark so a later delete can never
      // hand the number out again.
      ...highWater.map((h) =>
        prisma.vaterAccount.upsert({
          where: { userId: h.owner },
          create: { userId: h.owner, videoNumberMax: h.max },
          update: { videoNumberMax: h.max },
        }),
      ),
    ]);
  }
  return projects;
}
