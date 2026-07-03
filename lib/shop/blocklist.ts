import { prisma } from "@/lib/prisma";

export type BlocklistMatchType = "contains" | "exact" | "fbListingId" | "regex";

export interface BlocklistEntry {
  id: string;
  pattern: string;
  matchType: BlocklistMatchType;
  reason: string | null;
  createdAt: Date;
}

export interface BlocklistMatcher {
  isBlocked(input: { title: string; fbListingId: string | null }): BlocklistEntry | null;
  size: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export async function loadBlocklistMatcher(): Promise<BlocklistMatcher> {
  const rows = await prisma.shopBlocklist.findMany();
  const exact = new Map<string, BlocklistEntry>();
  const contains: BlocklistEntry[] = [];
  const byFbId = new Map<string, BlocklistEntry>();
  const regexes: Array<{ entry: BlocklistEntry; re: RegExp }> = [];
  for (const r of rows) {
    const entry: BlocklistEntry = {
      id: r.id,
      pattern: r.pattern,
      matchType: (r.matchType as BlocklistMatchType) ?? "contains",
      reason: r.reason ?? null,
      createdAt: r.createdAt,
    };
    if (entry.matchType === "exact") {
      exact.set(normalize(entry.pattern), entry);
    } else if (entry.matchType === "fbListingId") {
      byFbId.set(entry.pattern.trim(), entry);
    } else if (entry.matchType === "regex") {
      try {
        regexes.push({ entry, re: new RegExp(entry.pattern, "i") });
      } catch {
        // Bad regex — skip silently so one broken rule doesn't kill the sync.
      }
    } else {
      contains.push(entry);
    }
  }
  const containsLower = contains.map((e) => ({ entry: e, needle: normalize(e.pattern) }));

  return {
    size: rows.length,
    isBlocked({ title, fbListingId }) {
      if (fbListingId) {
        const hit = byFbId.get(fbListingId.trim());
        if (hit) return hit;
      }
      const t = normalize(title);
      const ex = exact.get(t);
      if (ex) return ex;
      for (const { entry, needle } of containsLower) {
        if (needle && t.includes(needle)) return entry;
      }
      for (const { entry, re } of regexes) {
        if (re.test(title)) return entry;
      }
      return null;
    },
  };
}
