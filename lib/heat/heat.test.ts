import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { heatCookieOptions, heatCookieValue, heatIngestAuthorized, heatPinMatches } from "./auth-core";
import { formatCostRange, formatElectricRate } from "./format";
import { parseHeatBody } from "./parse";
import { sampleHeatRows } from "./sample";
import { ELECTRIC_USD_PER_KWH, chicagoDate, chicagoDayStartMs, monthStart, startOfChicagoDay, weekStartMonday } from "./time";
import type { HeatDay, HeatSnapshot, LoftFanReading } from "./types";
import { buildHeatView, heatHoursInWindow } from "./view";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const now = new Date("2026-11-18T20:10:00.000Z");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function zone(hvac: HeatSnapshot["upstairs"]["hvac"]) {
  return { setpoint: 70, mode: "heat", hvac, fanMode: "auto" as string | null };
}

function fan(partial: Partial<LoftFanReading> = {}): LoftFanReading {
  return { on: null, watts: null, energyWh: null, decision: null, ...partial };
}

function snap(
  iso: string,
  up: HeatSnapshot["upstairs"]["hvac"],
  down: HeatSnapshot["downstairs"]["hvac"] = "off",
  loftFan: Partial<LoftFanReading> = {},
): HeatSnapshot {
  return {
    recordedAt: iso,
    kitchenF: 70,
    loftF: 68,
    kitchenRh: 40,
    loftRh: 38,
    outdoorF: 35,
    upstairs: zone(up),
    downstairs: { setpoint: 68, mode: "heat", hvac: down, fanMode: null },
    loftFan: fan(loftFan),
  };
}

function day(partial: Partial<HeatDay> & { date: string }): HeatDay {
  return {
    upstairsHeatH: 0,
    downstairsHeatH: 0,
    upstairsCycles: 0,
    downstairsCycles: 0,
    outdoorLow: null,
    outdoorHigh: null,
    outdoorAvg: null,
    hdd65: null,
    estThermsLow: null,
    estThermsHigh: null,
    estCostLow: null,
    estCostHigh: null,
    ccfPerHdd: null,
    ...partial,
  };
}

describe("heat clock", () => {
  it("uses Chicago calendar dates after the 2026 DST fallback", () => {
    const noon = new Date("2026-11-18T18:00:00.000Z");
    assert.equal(chicagoDate(noon), "2026-11-18");
    assert.equal(startOfChicagoDay(noon).toISOString(), "2026-11-18T06:00:00.000Z");
    assert.equal(new Date(chicagoDayStartMs("2026-11-18")).toISOString(), "2026-11-18T06:00:00.000Z");
    assert.equal(ELECTRIC_USD_PER_KWH, 0.12495);
    assert.equal(formatElectricRate(ELECTRIC_USD_PER_KWH), "12.495¢/kWh");
    assert.equal(weekStartMonday("2026-11-18"), "2026-11-16");
    assert.equal(weekStartMonday("2026-11-22"), "2026-11-16");
    assert.equal(monthStart("2026-11-18"), "2026-11-01");
  });
});

describe("heat hours", () => {
  it("counts the gap between readings and caps a long hole at 20 minutes", () => {
    const from = Date.parse("2026-11-18T15:00:00.000Z");
    const ten = heatHoursInWindow(
      [snap("2026-11-18T15:00:00.000Z", "heat"), snap("2026-11-18T15:10:00.000Z", "heat")],
      from,
      Date.parse("2026-11-18T15:10:00.000Z"),
    );
    assert.equal(ten.upstairs, 0.17);
    const hole = heatHoursInWindow(
      [snap("2026-11-18T15:00:00.000Z", "heat"), snap("2026-11-18T16:00:00.000Z", "off")],
      from,
      Date.parse("2026-11-18T16:00:00.000Z"),
    );
    assert.equal(hole.upstairs, 0.33);
    const carried = heatHoursInWindow(
      [snap("2026-11-18T14:55:00.000Z", "heat")],
      from,
      Date.parse("2026-11-18T15:30:00.000Z"),
    );
    assert.equal(carried.upstairs, 0.25);
    const stale = heatHoursInWindow(
      [snap("2026-11-18T14:00:00.000Z", "heat")],
      from,
      Date.parse("2026-11-18T16:00:00.000Z"),
    );
    assert.equal(stale.upstairs, 0);
  });
});

describe("heat view", () => {
  it("estimates today from recent cost per heat-hour and prefers a reported row", () => {
    const shots: HeatSnapshot[] = [];
    for (let i = 0; i <= 6; i++) {
      shots.push(snap(new Date(Date.parse("2026-11-18T15:00:00.000Z") + i * 10 * 60 * 1000).toISOString(), "heat"));
    }
    const estimated = buildHeatView(
      {
        latest: shots[shots.length - 1],
        snapshots: shots,
        days: [day({ date: "2026-11-17", upstairsHeatH: 4, downstairsHeatH: 2, estCostLow: 6, estCostHigh: 12, hdd65: 20, ccfPerHdd: 0.1 })],
        review: null,
      },
      new Date("2026-11-18T16:00:00.000Z"),
    );
    assert.equal(estimated.today.source, "estimated");
    assert.equal(estimated.today.upstairsHeatH, 1);
    assert.equal(estimated.today.costLow, 1);
    assert.equal(estimated.today.costHigh, 2);
    assert.equal(estimated.week.upstairsHeatH, 5);
    assert.equal(estimated.week.downstairsHeatH, 2);
    assert.equal(estimated.week.costLow, 7);
    assert.equal(estimated.week.costHigh, 14);

    const reported = buildHeatView(
      {
        latest: shots[shots.length - 1],
        snapshots: shots,
        days: [
          day({ date: "2026-11-17", upstairsHeatH: 4, downstairsHeatH: 2, estCostLow: 6, estCostHigh: 12, ccfPerHdd: 0.1, hdd65: 10 }),
          day({ date: "2026-11-18", upstairsHeatH: 1.5, downstairsHeatH: 0.5, estCostLow: 3, estCostHigh: 5, ccfPerHdd: 0.12, hdd65: 8 }),
        ],
        review: { date: "2026-11-17", text: "Cold morning." },
      },
      new Date("2026-11-18T16:00:00.000Z"),
    );
    assert.equal(reported.today.source, "reported");
    assert.equal(reported.today.costLow, 3);
    assert.equal(reported.today.costHigh, 5);
    assert.equal(reported.ccf.recentAvg, 0.11);
    assert.equal(reported.ccf.versusBaseline, 0);
    assert.equal(formatCostRange(4.2, 4.22), formatCostRange(4.2, 4.2));
    assert.match(formatCostRange(4, 6), /\$4\.00–\$6\.00/);
    assert.equal(formatCostRange(null, null), "—");
  });

  it("builds a live-looking sample for an afternoon in Chicago", () => {
    const view = { ...buildHeatView(sampleHeatRows(now), now), sample: true };
    assert.equal(view.sample, true);
    assert.equal(view.series24h.length, 145);
    assert.equal(view.today.source, "estimated");
    assert.ok((view.today.costLow ?? 0) > 0);
    assert.equal(view.latest?.upstairs.hvac, "fan");
    assert.equal(view.fan.hasData, true);
    assert.equal(view.fan.now?.on, true);
    assert.equal(view.fan.rateUsdPerKwh, 0.12495);
    assert.ok(view.fan.today.runtimeH > 0);
    assert.ok((view.fan.today.kwh ?? 0) > 0);
    assert.ok(view.fan.series.some((point) => point.fanOn === true && (point.gapF ?? 0) < 2));
    assert.ok(view.fan.series.some((point) => point.fanOn === false && (point.gapF ?? 0) > 3));
    assert.match(view.review?.text ?? "", /Sample review/);
    assert.equal(view.ccf.baseline, 0.11);
    assert.ok(view.days.length >= 21);
    for (let day = 0; day < 40; day++) {
      const at = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      for (const row of sampleHeatRows(at).days) {
        assert.ok(row.upstairsHeatH >= 0 && row.downstairsHeatH >= 0 && (row.ccfPerHdd ?? 0) > 0);
      }
    }
  });
});

describe("heat ingest parse", () => {
  it("accepts the documented examples and rejects bad rows", () => {
    const doc = read("docs/heat-ingest.md");
    const fences = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]);
    assert.ok(fences.length >= 4);
    for (const fence of fences) {
      const parsed = parseHeatBody(JSON.parse(fence), now);
      assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.error);
    }
    const bad = parseHeatBody(
      {
        timestamp: "2026-11-18T19:55:00Z",
        upstairs: { setpoint: 70, mode: "heat", hvac: "idle" },
        downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
      },
      now,
    );
    assert.equal(bad.ok, false);
    const future = parseHeatBody(
      {
        timestamp: "2026-11-18T22:00:00Z",
        upstairs: { setpoint: 70, mode: "heat", hvac: "off" },
        downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
      },
      now,
    );
    assert.equal(future.ok, false);
    assert.match(future.ok ? "" : future.error, /future/);
    const old = parseHeatBody(
      {
        timestamp: "2026-01-01T00:00:00Z",
        upstairs: { setpoint: 70, mode: "heat", hvac: "off" },
        downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
      },
      now,
    );
    assert.match(old.ok ? "" : old.error, /90 days/);
    const dupe = parseHeatBody(
      {
        snapshots: [
          {
            timestamp: "2026-11-18T19:00:00Z",
            kitchen_f: 60,
            upstairs: { setpoint: 70, mode: "heat", hvac: "off" },
            downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
          },
          {
            timestamp: "2026-11-18T19:00:00Z",
            kitchen_f: 71,
            upstairs: { setpoint: 70, mode: "heat", hvac: "heat" },
            downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
          },
        ],
      },
      now,
    );
    assert.equal(dupe.ok && dupe.batch.snapshots.length, 1);
    assert.equal(dupe.ok && dupe.batch.snapshots[0].kitchenF, 71);

    const legacy = parseHeatBody(
      {
        timestamp: "2026-11-18T19:55:00Z",
        kitchen_f: 71.2,
        loft_f: 68.4,
        upstairs: { setpoint: 70, mode: "heat", hvac: "heat", fan_mode: "auto" },
        downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
        ignored: true,
      },
      now,
    );
    assert.equal(legacy.ok, true);
    assert.deepEqual(legacy.ok && legacy.batch.snapshots[0].loftFan, {
      on: null,
      watts: null,
      energyWh: null,
      decision: null,
    });

    const withFan = parseHeatBody(
      {
        timestamp: "2026-11-18T19:55:00Z",
        kitchen_f: 71.2,
        loft_f: 74.6,
        upstairs: { setpoint: 70, mode: "heat", hvac: "heat" },
        downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
        loft_fan_on: true,
        loft_fan_w: 36,
        loft_fan_energy_wh_total: 18420.5,
        loft_fan_decision: " on: loft-living 3.4F, heat on ",
      },
      now,
    );
    assert.equal(withFan.ok, true);
    assert.deepEqual(withFan.ok && withFan.batch.snapshots[0].loftFan, {
      on: true,
      watts: 36,
      energyWh: 18420.5,
      decision: "on: loft-living 3.4F, heat on",
    });
    const badFan = parseHeatBody(
      {
        timestamp: "2026-11-18T19:55:00Z",
        upstairs: { setpoint: 70, mode: "heat", hvac: "off" },
        downstairs: { setpoint: 68, mode: "heat", hvac: "off" },
        loft_fan_w: -1,
      },
      now,
    );
    assert.equal(badFan.ok, false);
    assert.match(read("docs/heat-ingest.md"), /loft_fan_on/);
    assert.match(read("docs/heat-ingest.md"), /loft_fan_w/);
    assert.match(read("docs/heat-ingest.md"), /loft_fan_energy_wh_total/);
    assert.match(read("docs/heat-ingest.md"), /loft_fan_decision/);
    assert.match(read("docs/heat-ingest.md"), /0\.12495/);
    assert.match(read("prisma/schema.prisma"), /loftFanEnergyWh/);
    assert.match(read("prisma/migrations/20261121210000_heat_loft_fan/migration.sql"), /loftFanOn/);
    const sql = read("prisma/migrations/20261121210000_heat_loft_fan/migration.sql");
    const checksum = createHash("sha256").update(sql).digest("hex");
    assert.equal(checksum, "5993f124492bd8ac63d518d5211c19873ef4c32359072fb3a26196c9489844c7");
    assert.match(read("lib/heat/ensure-columns.ts"), new RegExp(checksum));
    for (const column of ["loftFanOn", "loftFanW", "loftFanEnergyWh", "loftFanDecision"]) {
      assert.match(read("lib/heat/ensure-columns.ts"), new RegExp(column));
    }
  });
});

describe("loft fan", () => {
  const at = new Date("2026-11-18T18:00:00.000Z");

  it("counts runtime, cycles, meter kWh, and folds the cost into the totals", () => {
    const shots = [
      snap("2026-11-17T23:00:00.000Z", "off", "off", { on: false, watts: 0, energyWh: 0, decision: "off: quiet hours" }),
    ];
    for (let i = 0; i <= 6; i++) {
      const iso = new Date(Date.parse("2026-11-18T16:00:00.000Z") + i * 10 * 60 * 1000).toISOString();
      shots.push(
        snap(iso, "heat", "off", {
          on: true,
          watts: 36,
          energyWh: (i * 1000) / 6,
          decision: "on: loft-living 3.4F, heat on",
        }),
      );
    }
    shots[1].kitchenF = 70;
    shots[1].loftF = 74;
    shots[7].kitchenF = 70.4;
    shots[7].loftF = 71.6;
    const view = buildHeatView(
      {
        latest: shots[7],
        snapshots: shots,
        days: [day({ date: "2026-11-17", upstairsHeatH: 4, downstairsHeatH: 2, estCostLow: 6, estCostHigh: 12, hdd65: 20, ccfPerHdd: 0.1 })],
        review: null,
      },
      new Date("2026-11-18T17:00:00.000Z"),
    );
    assert.equal(view.fan.now?.on, true);
    assert.equal(view.fan.now?.watts, 36);
    assert.equal(view.fan.today.runtimeH, 1);
    assert.equal(view.fan.today.cycles, 1);
    assert.equal(view.fan.today.kwh, 1);
    assert.equal(view.fan.today.cost, 0.12);
    assert.equal(view.fan.today.source, "meter");
    assert.equal(view.today.costLow, 1);
    assert.equal(view.today.costHigh, 2);
    assert.equal(view.today.energyCostLow, 1.12);
    assert.equal(view.today.energyCostHigh, 2.12);
    assert.equal(view.week.costLow, 7.12);
    assert.equal(view.week.costHigh, 14.12);
    assert.equal(view.week.fanCost, 0.12);
    assert.equal(view.week.fanKwh, 1);
    assert.equal(view.month.fanCost, 0.12);
    const onPoint = view.fan.series.find((point) => point.t === shots[1].recordedAt);
    const later = view.fan.series.find((point) => point.t === shots[7].recordedAt);
    assert.equal(onPoint?.gapF, 4);
    assert.equal(later?.gapF, 1.2);
    assert.equal(onPoint?.fanOn, true);

    const oneSided = buildHeatView(
      {
        latest: shots[7],
        snapshots: shots,
        days: [day({ date: "2026-11-18", upstairsHeatH: 1, downstairsHeatH: 0, estCostLow: 3 })],
        review: null,
      },
      new Date("2026-11-18T17:00:00.000Z"),
    );
    assert.equal(oneSided.today.source, "reported");
    assert.equal(oneSided.today.costLow, 3);
    assert.equal(oneSided.today.costHigh, null);
    assert.equal(oneSided.today.energyCostLow, 3.12);
    assert.equal(oneSided.today.energyCostHigh, null);
    assert.equal(oneSided.week.costLow, 3.12);
    assert.equal(oneSided.week.costHigh, null);
  });

  it("does not treat a long gap as hours on, and ignores a counter reset", () => {
    const gapped = buildHeatView(
      {
        latest: null,
        snapshots: [
          snap("2026-11-18T16:00:00.000Z", "off", "off", { on: true, watts: 36, energyWh: 500 }),
          snap("2026-11-18T17:00:00.000Z", "off", "off", { on: false, watts: 0, energyWh: 536 }),
        ],
        days: [],
        review: null,
      },
      at,
    );
    assert.equal(gapped.fan.today.runtimeH, 0.33);
    assert.equal(gapped.fan.today.kwh, 0.036);

    const reset = buildHeatView(
      {
        latest: null,
        snapshots: [
          snap("2026-11-18T15:00:00.000Z", "off", "off", { on: true, watts: 36, energyWh: 100 }),
          snap("2026-11-18T16:00:00.000Z", "off", "off", { on: true, watts: 36, energyWh: 50 }),
          snap("2026-11-18T17:00:00.000Z", "off", "off", { on: false, watts: 0, energyWh: 80 }),
        ],
        days: [],
        review: null,
      },
      at,
    );
    assert.equal(reset.fan.today.kwh, 0.03);
    assert.equal(reset.fan.today.cycles, 1);
    assert.equal(reset.fan.today.source, "meter");
  });

  it("estimates from watts or the 36 W nameplate when the counter is absent", () => {
    const fromWatts = buildHeatView(
      {
        latest: null,
        snapshots: [
          snap("2026-11-18T16:00:00.000Z", "off", "off", { on: true, watts: 36 }),
          snap("2026-11-18T17:00:00.000Z", "off", "off", { on: false, watts: 0 }),
        ],
        days: [],
        review: null,
      },
      at,
    );
    assert.equal(fromWatts.fan.today.source, "watts");
    assert.equal(fromWatts.fan.today.kwh, 0.012);
    assert.equal(fromWatts.fan.today.cost, 0);
    assert.equal(fromWatts.today.energyCostLow, null);
    assert.equal(fromWatts.week.costLow, null);

    const nameplate = buildHeatView(
      {
        latest: null,
        snapshots: [
          snap("2026-11-18T16:00:00.000Z", "off", "off", { on: true }),
          snap("2026-11-18T17:00:00.000Z", "off", "off", { on: false }),
        ],
        days: [],
        review: null,
      },
      at,
    );
    assert.equal(nameplate.fan.today.source, "nameplate");
    assert.equal(nameplate.fan.today.kwh, 0.012);
    assert.equal(nameplate.fan.hasData, true);

    const empty = buildHeatView({ latest: snap("2026-11-18T17:00:00.000Z", "off"), snapshots: [], days: [], review: null }, at);
    assert.equal(empty.fan.hasData, false);
    assert.equal(empty.fan.days.length, 0);
    assert.equal(empty.today.energyCostLow, empty.today.costLow);
  });

  it("keeps yesterday's on-cycle from starting again after midnight", () => {
    const view = buildHeatView(
      {
        latest: null,
        snapshots: [
          snap("2026-11-18T05:50:00.000Z", "off", "off", { on: true, watts: 36, energyWh: 1000 }),
          snap("2026-11-18T06:10:00.000Z", "off", "off", { on: true, watts: 36, energyWh: 1012 }),
          snap("2026-11-18T06:20:00.000Z", "off", "off", { on: false, watts: 0, energyWh: 1018 }),
        ],
        days: [],
        review: null,
      },
      at,
    );
    assert.equal(view.fan.today.cycles, 0);
    assert.equal(view.fan.today.runtimeH, 0.33);
    const yesterday = view.fan.days.find((d) => d.date === "2026-11-17");
    assert.equal(yesterday?.cycles, 1);
    assert.ok((yesterday?.kwh ?? 0) > 0);
    assert.ok((view.fan.today.kwh ?? 0) > 0);
  });
});

describe("heat gate", () => {
  const previous = {
    pin: process.env.HEAT_PIN,
    secret: process.env.AUTH_SECRET,
    token: process.env.HEAT_INGEST_TOKEN,
  };

  it("signs a separate cookie and checks the ingest bearer", () => {
    process.env.HEAT_PIN = "4321";
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.HEAT_INGEST_TOKEN = "test-ingest-token";
    try {
      assert.equal(heatPinMatches("4321"), true);
      assert.equal(heatPinMatches("0000"), false);
      assert.equal(heatPinMatches(""), false);
      const token = heatCookieValue();
      assert.equal(token, createHmac("sha256", "test-auth-secret").update("heat:4321").digest("base64url"));
      const cookie = heatCookieOptions();
      assert.equal(cookie.name, "heat_access");
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.path, "/");
      assert.equal(heatIngestAuthorized("Bearer test-ingest-token"), true);
      assert.equal(heatIngestAuthorized("bearer test-ingest-token"), true);
      assert.equal(heatIngestAuthorized("Bearer wrong"), false);
      assert.equal(heatIngestAuthorized("Basic test-ingest-token"), false);
      assert.equal(heatIngestAuthorized(null), false);
    } finally {
      restore("HEAT_PIN", previous.pin);
      restore("AUTH_SECRET", previous.secret);
      restore("HEAT_INGEST_TOKEN", previous.token);
    }
  });

  it("keeps /heat out of the nav, sitemap, and index", () => {
    assert.match(read("app/heat/page.tsx"), /index:\s*false/);
    assert.match(read("app/heat/page.tsx"), /validateHeatAccess/);
    assert.match(read("app/robots.ts"), /"\/heat\$"/);
    assert.match(read("scripts/audit-links.mjs"), /"\/heat"/);
    assert.doesNotMatch(read("app/sitemap.ts"), /"\/heat"/);
    assert.doesNotMatch(read("app/admin/page.tsx"), /"\/heat"/);
    assert.doesNotMatch(read("components/tolley/TolleyChrome.tsx"), /"\/heat"/);
    assert.match(read("app/api/heat/ingest/route.ts"), /heatIngestAuthorized/);
    assert.match(read("lib/company/route-inventory.json"), /app\/heat\/page\.tsx/);
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("humidifiers", () => {
  const today = chicagoDate(now);
  const withHumid = (iso: string, on: boolean | null, todayH: number | null = null): HeatSnapshot => ({
    ...snap(iso, "heat"),
    humid: { on, targetRh: 60, todayH, decision: on ? "on: heating:honeywell" : "off: idle" },
  });

  it("accepts optional humidifier fields on snapshots and daily rows", () => {
    const parsed = parseHeatBody(
      {
        snapshots: [
          {
            timestamp: "2026-11-18T20:00:00Z",
            upstairs: { hvac: "heat" },
            downstairs: { hvac: "off" },
            humid_on: true,
            humid_target_rh: 60,
            humid_today_h: 1.25,
            humid_decision: "on: circulate:upstairs_fan",
          },
        ],
        days: [
          { date: "2026-11-17", upstairs_heat_h: 2, downstairs_heat_h: 1, upstairs_cycles: 3, downstairs_cycles: 2,
            humid_on_h: 2.95, humid_cycles: 26, humid_kwh: 0.531, humid_cost: 0.066, humid_water_gal: 20.6 },
        ],
      },
      now,
    );
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.ok && parsed.batch.snapshots[0].humid, {
      on: true,
      targetRh: 60,
      todayH: 1.25,
      decision: "on: circulate:upstairs_fan",
    });
    assert.equal(parsed.ok && parsed.batch.days[0].humidOnH, 2.95);
    assert.equal(parsed.ok && parsed.batch.days[0].humidCycles, 26);
    const legacy = parseHeatBody({ timestamp: "2026-11-18T20:00:00Z", upstairs: { hvac: "off" }, downstairs: { hvac: "off" } }, now);
    assert.deepEqual(legacy.ok && legacy.batch.snapshots[0].humid, { on: null, targetRh: null, todayH: null, decision: null });
  });

  it("prices runtime at 2 x 90 W and adds it to today's energy and the period totals", () => {
    const view = buildHeatView(
      {
        latest: null,
        snapshots: [withHumid("2026-11-18T19:00:00.000Z", true, 1.5), withHumid("2026-11-18T20:05:00.000Z", false, 2)],
        days: [
          day({ date: "2026-11-17", upstairsHeatH: 2, estCostLow: 1, estCostHigh: 2, humidOnH: 3, humidCycles: 4 }),
        ],
        review: null,
      },
      now,
    );
    assert.equal(view.humid.hasData, true);
    assert.equal(view.humid.watts, 180);
    assert.equal(view.humid.today.source, "live");
    assert.equal(view.humid.today.runtimeH, 2);
    assert.equal(view.humid.today.kwh, 0.36);
    assert.equal(view.humid.today.cost, Math.round(0.36 * ELECTRIC_USD_PER_KWH * 100) / 100);
    assert.equal(view.humid.today.waterGal, 14);
    assert.equal(view.humid.now?.on, false);
    assert.equal(view.humid.now?.targetRh, 60);
    const yesterday = view.humid.days.find((d) => d.date === "2026-11-17");
    assert.equal(yesterday?.kwh, 0.54);
    assert.equal(view.week.humidRuntimeH, 5);
    assert.equal(view.week.humidKwh, 0.9);
    assert.ok((view.week.humidCost ?? 0) > 0.1);
    assert.equal(view.today.date, today);
    assert.ok((view.today.energyCostLow ?? 0) >= (view.today.costLow ?? 0) + (view.humid.today.cost ?? 0) - 0.001);
  });

  it("falls back to snapshot runtime when Spark sent no live counter", () => {
    const view = buildHeatView(
      {
        latest: null,
        snapshots: [withHumid("2026-11-18T19:00:00.000Z", true), withHumid("2026-11-18T19:30:00.000Z", false)],
        days: [],
        review: null,
      },
      now,
    );
    assert.equal(view.humid.today.source, "estimated");
    assert.equal(view.humid.today.runtimeH, 0.33);
  });

  it("documents and migrates the humidifier columns", () => {
    for (const field of ["humid_on", "humid_target_rh", "humid_today_h", "humid_decision", "humid_on_h", "humid_kwh", "humid_cost", "humid_water_gal"]) {
      assert.match(read("docs/heat-ingest.md"), new RegExp(field));
    }
    const sql = read("prisma/migrations/20261122220000_heat_humidifier/migration.sql");
    const checksum = createHash("sha256").update(sql).digest("hex");
    assert.match(read("lib/heat/ensure-columns.ts"), new RegExp(checksum));
    for (const column of ["humidOn", "humidTargetRh", "humidTodayH", "humidDecision", "humidOnH", "humidCycles", "humidKwh", "humidCost", "humidWaterGal"]) {
      assert.match(read("prisma/schema.prisma"), new RegExp(column));
      assert.match(read("lib/heat/ensure-columns.ts"), new RegExp(`"${column}"`));
    }
  });
});
