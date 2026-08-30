import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountHasDelivery,
  buildLanes,
  buildSnapshot,
  classifyCampaign,
  costPerResult,
  extractLeads,
  extractLpv,
  formatUsd,
  allTimeTooltip,
  colTooltip,
  costSignal,
  ctrSignal,
  daySpendSignal,
  headerColTitle,
  headerMetric,
  indyDateKey,
  laneTooltip,
  leadsSignal,
  leadsTooltip,
  lifetimeFromKey,
  mergeLifetime,
  windowTooltip,
  isAdsSnapshot,
  mapZernioCampaign,
  parseZernioCampaigns,
  placeholderSnapshot,
  rollupAccount,
  shortCampaignName,
  snapshotFromJson,
  snapshotIsFresh,
  yesterdayKey,
  JELLY_META,
  X_DIGIE,
  type AdsCampaignRow,
  type ZernioCampaign,
} from "./hq-ads.ts";

const JELLY_TODAY: ZernioCampaign[] = [
  {
    platformCampaignId: "120250041581990739",
    campaignName: "[8/26/2026] Animate Lady2 video $5",
    status: "active",
    platformCampaignStatus: "ACTIVE",
    metrics: {
      spend: 2.66,
      impressions: 252,
      clicks: 37,
      ctr: 14.68,
      actions: { landing_page_view: 37, omni_landing_page_view: 37 },
      funnel: { landingPageViews: 37, leads: 0 },
    },
  },
  {
    platformCampaignId: "120249977332660739",
    campaignName: "[8/21/2026] Animate Lady photo+words $5",
    status: "paused",
    platformCampaignStatus: "PAUSED",
    metrics: { spend: 0, impressions: 0, clicks: 0, ctr: 0, actions: {}, funnel: { landingPageViews: 0, leads: 0 } },
  },
  {
    platformCampaignId: "120249903317710739",
    campaignName: "Promoting https://tolley.io/animate?utm_source=fb&utm_medium=paid&utm_campaign=beta1",
    status: "error",
    platformCampaignStatus: "PAUSED",
    metrics: { spend: 0, impressions: 0, clicks: 0, ctr: 0, actions: {}, funnel: { landingPageViews: 0, leads: 0 } },
  },
];

const X_YESTERDAY: ZernioCampaign[] = [
  {
    platformCampaignId: "p61w0",
    campaignName: "jelly1",
    status: "active",
    platformCampaignStatus: "ACTIVE",
    metrics: {
      spend: 4.95,
      impressions: 3335,
      clicks: 179,
      ctr: 5.37,
      actions: {},
      funnel: { landingPageViews: 0, leads: 0 },
    },
  },
];

function row(partial: Partial<AdsCampaignRow> & Pick<AdsCampaignRow, "displayName" | "lane">): AdsCampaignRow {
  return {
    id: partial.id ?? partial.displayName,
    name: partial.name ?? partial.displayName,
    displayName: partial.displayName,
    status: partial.status ?? "",
    platformStatus: partial.platformStatus ?? "",
    spend: partial.spend ?? 0,
    lifetimeSpend: partial.lifetimeSpend ?? 0,
    impressions: partial.impressions ?? 0,
    clicks: partial.clicks ?? 0,
    lpv: partial.lpv ?? 0,
    leads: partial.leads ?? 0,
    ctr: partial.ctr ?? 0,
    costPerResult: partial.costPerResult ?? null,
    lane: partial.lane,
  };
}

describe("indyDateKey", () => {
  it("uses America/Indiana/Indianapolis, not UTC", () => {
    // 2026-08-30 03:30 UTC is still Aug 29 in Indianapolis (EDT, UTC-4).
    assert.equal(indyDateKey(new Date("2026-08-30T03:30:00.000Z")), "2026-08-29");
    assert.equal(indyDateKey(new Date("2026-08-30T04:05:00.000Z")), "2026-08-30");
  });
});

describe("yesterdayKey", () => {
  it("returns the previous Indianapolis civil day", () => {
    assert.equal(yesterdayKey(new Date("2026-08-30T16:00:00.000Z")), "2026-08-29");
    assert.equal(yesterdayKey(new Date("2026-08-30T03:30:00.000Z")), "2026-08-28");
  });
});

describe("shortCampaignName", () => {
  it("strips date prefix and Animate label", () => {
    assert.equal(shortCampaignName("[8/26/2026] Animate Lady2 video $5"), "Lady2 video $5");
    assert.equal(shortCampaignName("[8/21/2026] Animate Lady photo+words $5"), "Lady photo+words $5");
  });

  it("pulls utm_campaign from a Promoting URL name", () => {
    assert.equal(
      shortCampaignName("Promoting https://tolley.io/animate?utm_source=fb&utm_medium=paid&utm_campaign=beta1"),
      "beta1",
    );
  });

  it("leaves a plain X campaign name alone", () => {
    assert.equal(shortCampaignName("jelly1"), "jelly1");
  });
});

describe("classifyCampaign", () => {
  it("keeps an active spender", () => {
    assert.equal(classifyCampaign("active", "ACTIVE", 2.66), "keep");
  });

  it("fades paused campaigns including Zernio error+PAUSED", () => {
    assert.equal(classifyCampaign("paused", "PAUSED", 0), "fade");
    assert.equal(classifyCampaign("error", "PAUSED", 0), "fade");
  });

  it("watches an active campaign with no spend", () => {
    assert.equal(classifyCampaign("active", "ACTIVE", 0), "watch");
  });

  it("marks archived or cancelled as dark", () => {
    assert.equal(classifyCampaign("cancelled", "CANCELLED", 0), "dark");
    assert.equal(classifyCampaign("error", "DELETED", 0), "dark");
  });
});

describe("metrics", () => {
  it("reads LPV from funnel and treats 0 leads as a real number", () => {
    const metrics = JELLY_TODAY[0].metrics;
    assert.equal(extractLpv(metrics), 37);
    assert.equal(extractLeads(metrics), 0);
  });

  it("costs a result by leads, then LPV, then clicks", () => {
    assert.equal(costPerResult(10, 5, 2, 20), 5);
    assert.equal(costPerResult(2.66, 37, 0, 37), 2.66 / 37);
    assert.equal(costPerResult(4.95, 0, 0, 179), 4.95 / 179);
    assert.equal(costPerResult(0, 0, 0, 0), null);
  });
});

describe("mapZernioCampaign + snapshot", () => {
  it("builds today's Jelly Studio block from the live Zernio shape", () => {
    const campaigns = JELLY_TODAY.map(mapZernioCampaign);
    assert.deepEqual(
      campaigns.map((c) => c.displayName),
      ["Lady2 video $5", "Lady photo+words $5", "beta1"],
    );
    assert.deepEqual(
      campaigns.map((c) => c.lane),
      ["keep", "fade", "fade"],
    );
    assert.equal(campaigns[0].leads, 0);
    assert.equal(campaigns[0].lpv, 37);

    const account = rollupAccount(JELLY_META, campaigns, "today", "live");
    assert.equal(account.spend, 2.66);
    assert.equal(account.lifetimeSpend, 0);
    assert.equal(account.leads, 0);
    const metric = headerMetric(account, true);
    assert.equal(metric.kind, "LPV");
    assert.equal(metric.value, 37);
  });

  it("labels an empty-today X account as yesterday when that window delivered", () => {
    const x = rollupAccount(X_DIGIE, X_YESTERDAY.map(mapZernioCampaign), "yesterday", "live");
    assert.equal(x.window, "yesterday");
    assert.equal(x.spend, 4.95);
    assert.equal(x.campaigns[0].displayName, "jelly1");
    assert.equal(x.campaigns[0].lane, "keep");
    const metric = headerMetric(x, false);
    assert.equal(metric.kind, "clk");
    assert.equal(metric.value, 179);
  });

  it("rolls Keep / Fade / Watch / Dark across accounts", () => {
    const jelly = rollupAccount(JELLY_META, JELLY_TODAY.map(mapZernioCampaign), "today", "live");
    const x = rollupAccount(X_DIGIE, X_YESTERDAY.map(mapZernioCampaign), "yesterday", "live");
    const lanes = buildLanes([jelly, x]);
    assert.deepEqual(lanes.keep, ["Lady2 video $5", "jelly1"]);
    assert.deepEqual(lanes.fade, ["Lady photo+words $5", "beta1"]);
    assert.deepEqual(lanes.watch, []);
    assert.deepEqual(lanes.dark, []);
  });

  it("marks a snapshot live when any account is live", () => {
    const now = new Date("2026-08-30T16:00:00.000Z");
    const jelly = rollupAccount(JELLY_META, JELLY_TODAY.map(mapZernioCampaign), "today", "live");
    const snap = buildSnapshot([jelly], now);
    assert.equal(snap.source, "live");
    assert.equal(snap.timezone, "America/Indiana/Indianapolis");
    assert.equal(snap.day, "2026-08-30");
    assert.equal(isAdsSnapshot(snap), true);
    assert.equal(snapshotIsFresh(snap, now), true);
    assert.equal(snapshotIsFresh(snap, new Date("2026-08-31T16:00:00.000Z")), false);
  });

  it("builds a clearly marked placeholder when the ads API is down", () => {
    const snap = placeholderSnapshot(new Date("2026-08-30T16:00:00.000Z"), "awaiting ads API");
    assert.equal(snap.source, "placeholder");
    assert.equal(snap.accounts[0].source, "placeholder");
    assert.equal(snap.accounts[0].error, "awaiting ads API");
    assert.equal(snap.accounts[0].leads, 0);
    assert.deepEqual(snap.lanes.keep, []);
  });
});

describe("hq-posts placement", () => {
  it("renders the ads card after the DGX strip and before every-video", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile("components/hq/hq-posts.tsx", "utf8");
    const dgx = src.indexOf("<DgxActivityLine />");
    const ads = src.indexOf("<HqAdsStatus />");
    const video = src.indexOf("<HqVideoViews />");
    assert.ok(dgx >= 0 && ads >= 0 && video >= 0);
    assert.ok(dgx < ads && ads < video);
    assert.equal(/Renu/i.test(src), false);
  });
});

describe("parse + persist helpers", () => {
  it("parses a Zernio list body", () => {
    const parsed = parseZernioCampaigns({ campaigns: JELLY_TODAY, pagination: { total: 3 } });
    assert.equal(parsed.length, 3);
    assert.equal(parseZernioCampaigns({ campaigns: "nope" }).length, 0);
  });

  it("round-trips snapshot JSON and keeps 0 leads", () => {
    const jelly = rollupAccount(JELLY_META, JELLY_TODAY.map(mapZernioCampaign), "today", "live");
    const snap = buildSnapshot([jelly], new Date("2026-08-30T16:00:00.000Z"));
    const again = snapshotFromJson(JSON.parse(JSON.stringify(snap)));
    assert.ok(again);
    assert.equal(again.accounts[0].leads, 0);
    assert.equal(again.accounts[0].campaigns[0].leads, 0);
    assert.equal(formatUsd(again.accounts[0].spend), "$2.66");
  });

  it("merges lifetime spend onto the daily roster without clobbering today", () => {
    const daily = JELLY_TODAY.map(mapZernioCampaign);
    const life = [
      { ...JELLY_TODAY[0], metrics: { ...JELLY_TODAY[0].metrics, spend: 20.92 } },
      { ...JELLY_TODAY[1], metrics: { ...JELLY_TODAY[1].metrics, spend: 36.81 } },
      { ...JELLY_TODAY[2], metrics: { ...JELLY_TODAY[2].metrics, spend: 35.55 } },
    ].map(mapZernioCampaign);
    const merged = mergeLifetime(daily, life);
    const account = rollupAccount(JELLY_META, merged, "today", "live");
    assert.equal(merged[0].spend, 2.66);
    assert.equal(merged[0].lifetimeSpend, 20.92);
    assert.equal(merged[0].lpv, 37);
    assert.equal(account.spend, 2.66);
    assert.equal(account.lifetimeSpend, 20.92 + 36.81 + 35.55);
    assert.equal(account.leads, 0);
  });

  it("does not treat a campaign with only zeros as delivery", () => {
    assert.equal(
      accountHasDelivery([row({ displayName: "jelly1", lane: "watch", spend: 0, impressions: 0 })]),
      false,
    );
    assert.equal(
      accountHasDelivery([row({ displayName: "jelly1", lane: "keep", spend: 4.95, impressions: 10 })]),
      true,
    );
  });
});

describe("signals", () => {
  it("reads cheap LPV and high CTR as good on a live spender", () => {
    assert.equal(ctrSignal(14.68, "keep"), "good");
    assert.equal(costSignal(2.66 / 37, true, "keep"), "good");
    assert.equal(daySpendSignal(2.66, "keep"), "good");
  });

  it("reads 0 leads on a live spender as watch, not good", () => {
    assert.equal(leadsSignal(0, "keep"), "watch");
    assert.equal(leadsSignal(0, "fade"), "muted");
  });

  it("mutes paused $0 rows", () => {
    assert.equal(ctrSignal(0, "fade"), "muted");
    assert.equal(costSignal(null, true, "fade"), "muted");
    assert.equal(daySpendSignal(0, "fade"), "muted");
  });
});

describe("tooltips", () => {
  it("names each abbreviation and says if the value is good, soft, or watch", () => {
    const keep = mapZernioCampaign(JELLY_TODAY[0]);
    const fade = mapZernioCampaign(JELLY_TODAY[1]);
    assert.match(colTooltip("lpv", keep, true), /LPV: landing page views/);
    assert.match(colTooltip("lpv", keep, true), /good/);
    assert.match(colTooltip("clk", keep, true), /Clk: link clicks/);
    assert.match(colTooltip("imp", keep, true), /Imp: impressions/);
    assert.match(colTooltip("ctr", keep, true), /CTR: click-through rate/);
    assert.match(colTooltip("ctr", keep, true), /good/);
    assert.match(colTooltip("cpr", keep, true), /\$\/result/);
    assert.match(colTooltip("cpr", keep, true), /good/);
    assert.match(colTooltip("day$", fade, true), /Day \$/);
    assert.match(colTooltip("day$", fade, true), /fade/i);
    assert.match(colTooltip("life$", keep, true), /all-time|lifetime/i);
    assert.match(leadsTooltip(0, "keep"), /0 leads/);
    assert.match(leadsTooltip(0, "keep"), /watch/);
    assert.match(laneTooltip("keep"), /Keep/);
    assert.match(laneTooltip("fade"), /Fade/);
    assert.match(laneTooltip("watch"), /Watch/);
    assert.match(laneTooltip("dark"), /Dark/);
    assert.match(windowTooltip("today"), /Today/);
    assert.match(windowTooltip("yesterday"), /Yesterday/);
    assert.match(allTimeTooltip(), /All-time/);
    assert.match(headerColTitle("day$"), /Day \$/);
    assert.match(headerColTitle("life$"), /Life \$/);
  });

  it("computes a 730-day lifetime floor", () => {
    const from = lifetimeFromKey(new Date("2026-08-30T16:00:00.000Z"));
    assert.match(from, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(from < "2026-08-30");
  });
});
