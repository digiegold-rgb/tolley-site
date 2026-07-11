import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  buildDirectory,
  DIRECTORY_GROUP_ORDER,
  type DirectoryGroup,
} from "@/lib/directory";

/**
 * Live numbers behind tolley.io/circle. Rolls the last 30 days of real
 * SiteView traffic and EmailLead/LeadAction captures up to the directory
 * groups the flywheel renders. Counts only — no PII — so the endpoint and
 * page stay public-safe.
 */

export interface CircleGroupStats {
  group: DirectoryGroup;
  visits30d: number;
  leads30d: number;
}

export interface CircleStats {
  groups: CircleGroupStats[];
  totals: {
    visits30d: number;
    leads30d: number;
    /** Referrer classes (facebook, tiktok, ...) by share of tracked visits. */
    topSources: { source: string; visits: number }[];
  };
  generatedAt: string;
}

async function computeCircleStats(): Promise<CircleStats> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const directory = buildDirectory();
  const groupOf = new Map(directory.map((e) => [e.name, e.group]));

  const [views, actionLeads, emailLeads, referrers] = await Promise.all([
    prisma.siteView.groupBy({
      by: ["site"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.leadAction.groupBy({
      by: ["subsite"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.emailLead.groupBy({
      by: ["source"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.siteView.groupBy({
      by: ["referrer"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const visitsByGroup = new Map<DirectoryGroup, number>();
  const leadsByGroup = new Map<DirectoryGroup, number>();
  let totalVisits = 0;
  let totalLeads = 0;

  for (const v of views) {
    totalVisits += v._count._all;
    const group = groupOf.get(v.site);
    if (group) visitsByGroup.set(group, (visitsByGroup.get(group) ?? 0) + v._count._all);
  }
  for (const rows of [actionLeads.map((r) => ({ key: r.subsite, n: r._count._all })), emailLeads.map((r) => ({ key: r.source, n: r._count._all }))]) {
    for (const { key, n } of rows) {
      totalLeads += n;
      const group = groupOf.get(key);
      if (group) leadsByGroup.set(group, (leadsByGroup.get(group) ?? 0) + n);
    }
  }

  const NOT_A_SOURCE = new Set(["direct", "internal", "other", ""]);
  const topSources = referrers
    .map((r) => ({ source: r.referrer ?? "", visits: r._count._all }))
    .filter((r) => !NOT_A_SOURCE.has(r.source))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);

  return {
    groups: DIRECTORY_GROUP_ORDER.map((group) => ({
      group,
      visits30d: visitsByGroup.get(group) ?? 0,
      leads30d: leadsByGroup.get(group) ?? 0,
    })),
    totals: { visits30d: totalVisits, leads30d: totalLeads, topSources },
    generatedAt: new Date().toISOString(),
  };
}

/** Cached 15 min — the flywheel doesn't need realtime, and this hits 4 groupBys. */
export const getCircleStats = unstable_cache(computeCircleStats, ["circle-stats"], {
  revalidate: 900,
});
