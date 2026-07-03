/**
 * Bridge: pull cached Plaid transactions from xero-ledger:8920 and ingest
 * into BudgetEntry rows. Dedupes against existing voice/manual entries.
 *
 * Skipped categories (Plaid `personal_finance_category.primary`):
 *   - TRANSFER_IN, TRANSFER_OUT — internal transfers, not budget spend
 *   - LOAN_PAYMENTS — handled by recurring bills (future)
 *   - INCOME — positive cash flow, not an expense
 *
 * Sign convention:
 *   - Plaid: positive amount = outflow (charge), negative = inflow (refund)
 *   - BudgetEntry: negative cents = expense, positive cents = refund/income
 */

import { prisma } from "@/lib/prisma";
import { categorizePlaidBatch, type PlaidCategorization } from "./llm";

const LEDGER_BASE =
  process.env.LEDGER_URL || process.env.LEDGER_BASE_URL || "http://127.0.0.1:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

const SKIP_PRIMARY = new Set([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOAN_PAYMENTS",
  "INCOME",
]);

type PlaidTxn = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  authorized_date: string | null;
  datetime: string | null;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
  _tax?: { taxCategory?: string; irsLine?: string; accountCode?: number | null } | null;
};

export type SyncReport = {
  fetched: number;
  filteredOut: number;
  alreadyImported: number;
  inserted: number;
  dedupedToExisting: number;
  needsReview: number;
  newAccounts: number;
  categorized: number;
  errors: string[];
};

export async function fetchLedgerTransactions(): Promise<PlaidTxn[]> {
  if (!LEDGER_TOKEN) {
    throw new Error("LEDGER_BEARER_TOKEN not configured");
  }
  const res = await fetch(`${LEDGER_BASE}/export/plaid`, {
    headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`xero-ledger /export/plaid ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as PlaidTxn[];
  if (!Array.isArray(data)) {
    throw new Error("xero-ledger /export/plaid did not return an array");
  }
  return data;
}

function shortAccountLabel(accountId: string) {
  return `Account ${accountId.slice(-6)}`;
}

async function ensureAccountRows(
  userId: string,
  accountIds: string[],
): Promise<{ map: Map<string, { isPersonal: boolean }>; created: number }> {
  const existing = await prisma.budgetPlaidAccount.findMany({
    where: { userId, plaidAccountId: { in: accountIds } },
  });
  const map = new Map<string, { isPersonal: boolean }>();
  for (const row of existing) {
    map.set(row.plaidAccountId, { isPersonal: row.isPersonal });
  }
  const missing = accountIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    await prisma.budgetPlaidAccount.createMany({
      data: missing.map((id) => ({
        userId,
        plaidAccountId: id,
        name: shortAccountLabel(id),
        isPersonal: true,
      })),
      skipDuplicates: true,
    });
    for (const id of missing) {
      map.set(id, { isPersonal: true });
    }
  }
  return { map, created: missing.length };
}

function findVendor(t: PlaidTxn): string {
  return (
    t.merchant_name?.trim() ||
    t.name?.trim().slice(0, 60) ||
    "Unknown"
  );
}

function findOccurredAt(t: PlaidTxn): Date {
  const iso = t.datetime || `${t.authorized_date || t.date}T12:00:00Z`;
  const d = new Date(iso);
  if (Number.isFinite(d.getTime())) return d;
  return new Date(t.date);
}

const DEDUPE_AMOUNT_TOLERANCE_CENTS = 50;
const DEDUPE_DAY_WINDOW = 3;

async function findDuplicate(
  userId: string,
  amountCents: number,
  occurredAt: Date,
  vendor: string,
) {
  const minDate = new Date(occurredAt);
  minDate.setDate(minDate.getDate() - DEDUPE_DAY_WINDOW);
  const maxDate = new Date(occurredAt);
  maxDate.setDate(maxDate.getDate() + DEDUPE_DAY_WINDOW);

  const candidates = await prisma.budgetEntry.findMany({
    where: {
      userId,
      occurredAt: { gte: minDate, lte: maxDate },
      amountCents: {
        gte: amountCents - DEDUPE_AMOUNT_TOLERANCE_CENTS,
        lte: amountCents + DEDUPE_AMOUNT_TOLERANCE_CENTS,
      },
      plaidTxId: null,
      source: { in: ["MANUAL", "VOICE"] },
    },
    take: 5,
  });
  if (candidates.length === 0) return null;

  const lowerVendor = vendor.toLowerCase();
  const fuzzy = candidates.find((c) => {
    if (!c.vendor) return false;
    const cv = c.vendor.toLowerCase();
    return cv.includes(lowerVendor) || lowerVendor.includes(cv);
  });
  return fuzzy ?? candidates[0];
}

export async function syncPlaidToBudget(userId: string): Promise<SyncReport> {
  const report: SyncReport = {
    fetched: 0,
    filteredOut: 0,
    alreadyImported: 0,
    inserted: 0,
    dedupedToExisting: 0,
    needsReview: 0,
    newAccounts: 0,
    categorized: 0,
    errors: [],
  };

  const txns = await fetchLedgerTransactions();
  report.fetched = txns.length;

  const uniqueAccountIds = Array.from(new Set(txns.map((t) => t.account_id)));
  const { map: accountMap, created } = await ensureAccountRows(userId, uniqueAccountIds);
  report.newAccounts = created;

  const candidates = txns.filter((t) => {
    if (t.pending) return false;
    const primary = t.personal_finance_category?.primary || "";
    if (SKIP_PRIMARY.has(primary)) return false;
    const acct = accountMap.get(t.account_id);
    if (!acct?.isPersonal) return false;
    return true;
  });
  report.filteredOut = txns.length - candidates.length;

  if (candidates.length === 0) return report;

  const existingIds = new Set(
    (
      await prisma.budgetEntry.findMany({
        where: {
          userId,
          plaidTxId: { in: candidates.map((c) => c.transaction_id) },
        },
        select: { plaidTxId: true },
      })
    )
      .map((row) => row.plaidTxId)
      .filter((id): id is string => Boolean(id)),
  );
  report.alreadyImported = existingIds.size;

  const fresh = candidates.filter((c) => !existingIds.has(c.transaction_id));
  if (fresh.length === 0) return report;

  const categories = await prisma.budgetCategory.findMany({
    where: { userId, archived: false },
    select: { id: true, slug: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));

  const llmInput = fresh.map((t) => ({
    id: t.transaction_id,
    vendor: findVendor(t),
    amount: Math.abs(t.amount),
    plaidCategory: t.personal_finance_category?.primary || null,
  }));

  let categorizations: PlaidCategorization[] = [];
  try {
    const BATCH = 25;
    for (let i = 0; i < llmInput.length; i += BATCH) {
      const slice = llmInput.slice(i, i + BATCH);
      const out = await categorizePlaidBatch(slice, categories);
      categorizations.push(...out);
    }
  } catch (err) {
    report.errors.push(`LLM categorize: ${err instanceof Error ? err.message : String(err)}`);
    categorizations = [];
  }
  const catById = new Map(categorizations.map((c) => [c.id, c]));
  report.categorized = categorizations.length;

  for (const t of fresh) {
    try {
      const vendor = findVendor(t);
      const occurredAt = findOccurredAt(t);
      const amountCents = -Math.round(t.amount * 100);
      const cat = catById.get(t.transaction_id);
      const matchedSlug = cat?.categorySlug && slugToId.has(cat.categorySlug) ? cat.categorySlug : null;

      const dup = await findDuplicate(userId, amountCents, occurredAt, vendor);
      if (dup) {
        await prisma.budgetEntry.update({
          where: { id: dup.id },
          data: {
            plaidTxId: t.transaction_id,
            plaidAccount: t.account_id,
            ...(dup.categoryId
              ? {}
              : matchedSlug
                ? { categoryId: slugToId.get(matchedSlug)! }
                : {}),
            tags: Array.from(new Set([...(dup.tags || []), ...(cat?.tags ?? [])])),
          },
        });
        report.dedupedToExisting += 1;
        continue;
      }

      const tags = cat?.tags ?? [];
      const needsReview = !matchedSlug;

      await prisma.budgetEntry.create({
        data: {
          userId,
          categoryId: matchedSlug ? slugToId.get(matchedSlug)! : null,
          amountCents,
          vendor,
          tags,
          occurredAt,
          source: "PLAID",
          plaidTxId: t.transaction_id,
          plaidAccount: t.account_id,
          needsReview,
          rawText: null,
        },
      });
      report.inserted += 1;
      if (needsReview) report.needsReview += 1;
    } catch (err) {
      report.errors.push(
        `txn ${t.transaction_id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return report;
}

export async function recategorizeNeedsReview(userId: string): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  const pending = await prisma.budgetEntry.findMany({
    where: { userId, needsReview: true },
    take: 100,
  });
  if (pending.length === 0) return { updated: 0, errors };

  const categories = await prisma.budgetCategory.findMany({
    where: { userId, archived: false },
    select: { id: true, slug: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));

  const input = pending.map((p) => ({
    id: p.id,
    vendor: p.vendor || p.note || p.rawText || "Unknown",
    amount: Math.abs(p.amountCents) / 100,
    plaidCategory: null,
  }));

  let categorizations: PlaidCategorization[] = [];
  try {
    categorizations = await categorizePlaidBatch(input, categories);
  } catch (err) {
    errors.push(`LLM categorize: ${err instanceof Error ? err.message : String(err)}`);
    return { updated: 0, errors };
  }

  let updated = 0;
  for (const c of categorizations) {
    if (!c.categorySlug || !slugToId.has(c.categorySlug)) continue;
    try {
      await prisma.budgetEntry.update({
        where: { id: c.id },
        data: {
          categoryId: slugToId.get(c.categorySlug)!,
          tags: c.tags,
          needsReview: false,
        },
      });
      updated += 1;
    } catch (err) {
      errors.push(`entry ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { updated, errors };
}
