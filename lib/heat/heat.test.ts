import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { heatCookieOptions, heatCookieValue, heatIngestAuthorized, heatPinMatches } from "./auth-core";
import { formatCostRange } from "./format";
import { parseHeatBody } from "./parse";
import { sampleHeatRows } from "./sample";
import { chicagoDate, monthStart, startOfChicagoDay, weekStartMonday } from "./time";
import type { HeatDay, HeatSnapshot } from "./types";
import { buildHeatView, heatHoursInWindow } from "./view";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const now = new Date("2026-11-18T20:10:00.000Z");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function zone(hvac: HeatSnapshot["upstairs"]["hvac"]) {
  return { setpoint: 70, mode: "heat", hvac, fanMode: "auto" as string | null };
}

function snap(iso: string, up: HeatSnapshot["upstairs"]["hvac"], down: HeatSnapshot["downstairs"]["hvac"] = "off"): HeatSnapshot {
  return {
    recordedAt: iso,
    kitchenF: 70,
    loftF: 68,
    kitchenRh: 40,
    loftRh: 38,
    outdoorF: 35,
    upstairs: zone(up),
    downstairs: { setpoint: 68, mode: "heat", hvac: down, fanMode: null },
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
