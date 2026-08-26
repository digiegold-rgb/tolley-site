import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chicagoDayKey,
  formatSmsDayLabel,
  smsDayInstant,
  withSmsDayDividers,
} from "./hq-sms-day.ts";

describe("smsDayInstant", () => {
  it("prefers sentAt when present", () => {
    assert.equal(
      smsDayInstant({ createdAt: "2026-08-25T12:00:00.000Z", sentAt: "2026-08-26T12:00:00.000Z" }),
      "2026-08-26T12:00:00.000Z",
    );
  });

  it("falls back to createdAt when sentAt is missing", () => {
    assert.equal(smsDayInstant({ createdAt: "2026-08-26T12:00:00.000Z", sentAt: null }), "2026-08-26T12:00:00.000Z");
    assert.equal(smsDayInstant({ createdAt: "2026-08-26T12:00:00.000Z" }), "2026-08-26T12:00:00.000Z");
  });
});

describe("chicagoDayKey", () => {
  it("uses America/Chicago, not UTC", () => {
    // 2026-08-26 04:30 UTC is still Aug 25 in Chicago (CDT, UTC-5).
    assert.equal(chicagoDayKey("2026-08-26T04:30:00.000Z"), "2026-08-25");
    // 2026-08-26 05:05 UTC is Aug 26 in Chicago.
    assert.equal(chicagoDayKey("2026-08-26T05:05:00.000Z"), "2026-08-26");
    // January is CST (UTC-6).
    assert.equal(chicagoDayKey("2026-01-15T05:30:00.000Z"), "2026-01-14");
    assert.equal(chicagoDayKey("2026-01-15T06:05:00.000Z"), "2026-01-15");
  });

  it("returns empty for invalid timestamps", () => {
    assert.equal(chicagoDayKey("not-a-date"), "");
  });
});

describe("formatSmsDayLabel", () => {
  const now = new Date("2026-08-26T16:00:00.000Z"); // Wednesday in Chicago

  it("says Today and Yesterday for the current Chicago day", () => {
    assert.equal(formatSmsDayLabel("2026-08-26T16:00:00.000Z", now), "Today");
    assert.equal(formatSmsDayLabel("2026-08-25T16:00:00.000Z", now), "Yesterday");
  });

  it("uses weekday + short month for older days", () => {
    assert.equal(formatSmsDayLabel("2026-08-24T16:00:00.000Z", now), "Monday, Aug 24");
  });

  it("includes the year when it is not the current year", () => {
    assert.equal(formatSmsDayLabel("2025-12-31T18:00:00.000Z", now), "Wednesday, Dec 31, 2025");
  });
});

describe("withSmsDayDividers", () => {
  const now = new Date("2026-08-26T16:00:00.000Z");

  it("puts a date line above the first message and on each new Chicago day", () => {
    const rows = withSmsDayDividers(
      [
        { id: "a", createdAt: "2026-08-24T16:00:00.000Z", sentAt: null },
        { id: "b", createdAt: "2026-08-24T18:00:00.000Z", sentAt: null },
        { id: "c", createdAt: "2026-08-25T16:00:00.000Z", sentAt: null },
        { id: "d", createdAt: "2026-08-26T16:00:00.000Z", sentAt: null },
      ],
      now,
    );
    assert.deepEqual(
      rows.map((r) => ({ id: r.message.id, dayLabel: r.dayLabel })),
      [
        { id: "a", dayLabel: "Monday, Aug 24" },
        { id: "b", dayLabel: null },
        { id: "c", dayLabel: "Yesterday" },
        { id: "d", dayLabel: "Today" },
      ],
    );
  });

  it("groups by sentAt when that crosses a Chicago midnight", () => {
    const rows = withSmsDayDividers(
      [
        { id: "drafted-mon", createdAt: "2026-08-24T16:00:00.000Z", sentAt: "2026-08-25T16:00:00.000Z" },
        { id: "tue", createdAt: "2026-08-25T18:00:00.000Z", sentAt: null },
      ],
      now,
    );
    assert.equal(rows[0].dayLabel, "Yesterday");
    assert.equal(rows[1].dayLabel, null);
  });

  it("returns an empty list for no messages", () => {
    assert.deepEqual(withSmsDayDividers([], now), []);
  });
});
