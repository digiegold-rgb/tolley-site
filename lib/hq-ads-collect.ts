/**
 * Server-only collector for the /hq ads card.
 * GET /v1/ads/campaigns — never create, pause, edit, or spend.
 */
import {
  HQ_AD_ACCOUNTS,
  accountHasDelivery,
  buildSnapshot,
  indyDateKey,
  mapZernioCampaign,
  parseZernioCampaigns,
  placeholderAccount,
  placeholderSnapshot,
  rollupAccount,
  yesterdayKey,
  type AdsAccountBlock,
  type AdsSnapshot,
  type HqAdAccountSpec,
} from "@/lib/hq-ads";

const ZERNIO_ADS = "https://zernio.com/api/v1/ads/campaigns";

async function zernioGetCampaigns(
  spec: HqAdAccountSpec,
  fromDate: string,
  toDate: string,
): Promise<ReturnType<typeof parseZernioCampaigns>> {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error("ZERNIO_API_KEY missing");
  const url = new URL(ZERNIO_ADS);
  url.searchParams.set("accountId", spec.zernioAccountId);
  url.searchParams.set("adAccountId", spec.adAccountId);
  url.searchParams.set("fromDate", fromDate);
  url.searchParams.set("toDate", toDate);
  url.searchParams.set("source", "all");
  url.searchParams.set("limit", "50");
  if (spec.includeEmpty) url.searchParams.set("includeEmpty", "true");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zernio ${res.status}: ${text.slice(0, 240)}`);
  }
  return parseZernioCampaigns(text ? JSON.parse(text) : {});
}

export async function collectAccount(
  spec: HqAdAccountSpec,
  now: Date = new Date(),
): Promise<AdsAccountBlock> {
  const today = indyDateKey(now);
  const yesterday = yesterdayKey(now);
  try {
    const todayRows = (await zernioGetCampaigns(spec, today, today)).map(mapZernioCampaign);
    if (accountHasDelivery(todayRows)) {
      return rollupAccount(spec, todayRows, "today", "live");
    }
    if (todayRows.length > 0) {
      try {
        const yRows = (await zernioGetCampaigns(spec, yesterday, yesterday)).map(mapZernioCampaign);
        if (accountHasDelivery(yRows)) {
          return rollupAccount(spec, yRows, "yesterday", "live");
        }
      } catch {
        /* keep today's empty-but-live roster */
      }
      return rollupAccount(spec, todayRows, "today", "live");
    }
    return placeholderAccount(spec, "no campaigns");
  } catch (err) {
    return placeholderAccount(spec, err instanceof Error ? err.message : String(err));
  }
}

export async function collectAdsSnapshot(now: Date = new Date()): Promise<AdsSnapshot> {
  if (!process.env.ZERNIO_API_KEY) {
    return placeholderSnapshot(now, "awaiting ads API");
  }
  const accounts = [];
  for (const spec of HQ_AD_ACCOUNTS) {
    accounts.push(await collectAccount(spec, now));
  }
  return buildSnapshot(accounts, now);
}
