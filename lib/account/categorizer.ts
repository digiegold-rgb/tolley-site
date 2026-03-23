// @ts-nocheck — references removed Prisma models
import { prisma } from '@/lib/prisma';

interface CategorizationResult {
  accountCode: string;
  note: string | null;
  confidence: number;
  needsReview?: boolean;
}

let rulesCache: Awaited<ReturnType<typeof loadRules>> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

async function loadRules() {
  return prisma.categorizationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  });
}

async function getRules() {
  if (rulesCache && Date.now() - cacheTime < CACHE_TTL) return rulesCache;
  rulesCache = await loadRules();
  cacheTime = Date.now();
  return rulesCache;
}

export async function categorize(
  description: string,
  amount: number,
): Promise<CategorizationResult | null> {
  const rules = await getRules();
  const descLower = description.toLowerCase();

  // First pass: description-based rules
  for (const rule of rules) {
    if (rule.matchField !== 'description') continue;

    let matched = false;
    const val = rule.matchValue.toLowerCase();

    switch (rule.matchType) {
      case 'contains':
        matched = descLower.includes(val);
        break;
      case 'startsWith':
        matched = descLower.startsWith(val);
        break;
      case 'exact':
        matched = descLower === val;
        break;
      case 'regex':
        try {
          matched = new RegExp(rule.matchValue, 'i').test(description);
        } catch {
          matched = false;
        }
        break;
    }

    if (matched) {
      const needsReview = rule.accountCode.includes('_TRANSFER');
      return {
        accountCode: rule.accountCode,
        note: rule.note,
        confidence: needsReview ? 50 : 80,
        needsReview,
      };
    }
  }

  // Second pass: amount-based rules
  for (const rule of rules) {
    if (rule.matchField !== 'amount') continue;

    let matched = false;
    const ruleAmount = parseFloat(rule.matchValue);

    switch (rule.matchType) {
      case 'exact':
        matched = Math.abs(amount - ruleAmount) < 0.01;
        break;
      case 'contains':
        matched = amount.toString().includes(rule.matchValue);
        break;
    }

    if (matched) {
      const needsReview = rule.accountCode.includes('_TRANSFER');
      return {
        accountCode: rule.accountCode,
        note: rule.note,
        confidence: needsReview ? 40 : 60,
        needsReview,
      };
    }
  }

  return null;
}

export function clearCategorizerCache() {
  rulesCache = null;
  cacheTime = 0;
}
