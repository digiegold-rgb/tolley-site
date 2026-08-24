import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCIERGE_STATUSES,
  CUSTOMER_STAGE_LABELS,
  IN_FLIGHT_STATUSES,
  QUEUED_STATUSES,
  STATUS_LABELS,
  customerStage,
  customerStageDetail,
  type YouTubeProjectStatus,
} from "./youtube-status";

describe("customerStage — queued → in progress → done", () => {
  it("maps queued + concierge_queued to queued", () => {
    assert.equal(customerStage("queued"), "queued");
    assert.equal(customerStage("concierge_queued"), "queued");
    assert.ok(QUEUED_STATUSES.has("queued"));
    assert.ok(QUEUED_STATUSES.has("concierge_queued"));
  });

  it("maps other in-flight statuses and concierge_in_progress to in_progress", () => {
    const inFlightNotQueued = [...IN_FLIGHT_STATUSES].filter(
      (s) => !QUEUED_STATUSES.has(s),
    );
    assert.ok(inFlightNotQueued.length > 0);
    for (const status of inFlightNotQueued) {
      assert.equal(customerStage(status), "in_progress", status);
    }
    assert.equal(customerStage("concierge_in_progress"), "in_progress");
    assert.equal(customerStage("editing"), "in_progress");
  });

  it("maps ready (delivered concierge) to done", () => {
    assert.equal(customerStage("ready"), "done");
  });

  it("does not invent stages for parked / failed / needs-info", () => {
    assert.equal(customerStage("draft"), null);
    assert.equal(customerStage("failed"), null);
    assert.equal(customerStage("concierge_needs_info"), null);
    assert.equal(customerStage("awaiting_script_approval"), null);
    assert.equal(customerStage("scripted"), null);
  });

  it("keeps chip copy on STATUS_LABELS", () => {
    assert.equal(customerStageDetail("queued"), STATUS_LABELS.queued);
    assert.equal(
      customerStageDetail("concierge_queued"),
      STATUS_LABELS.concierge_queued,
    );
    assert.equal(
      customerStageDetail("concierge_in_progress"),
      STATUS_LABELS.concierge_in_progress,
    );
    assert.equal(customerStageDetail("ready"), STATUS_LABELS.ready);
    assert.equal(
      customerStageDetail("generating_scenes"),
      STATUS_LABELS.generating_scenes,
    );
    assert.match(STATUS_LABELS.concierge_queued, /Fable 5/);
    assert.equal(CUSTOMER_STAGE_LABELS.done, "Done");
  });

  it("queued is in-flight for polling but still a queued customer stage", () => {
    assert.ok(IN_FLIGHT_STATUSES.has("queued"));
    assert.equal(customerStage("queued"), "queued");
    assert.notEqual(customerStage("queued"), "in_progress");
  });

  it("concierge set is covered without a parallel enum", () => {
    const mapped: Record<string, ReturnType<typeof customerStage>> = {};
    for (const status of CONCIERGE_STATUSES) {
      mapped[status] = customerStage(status);
    }
    assert.deepEqual(mapped, {
      concierge_queued: "queued",
      concierge_in_progress: "in_progress",
      concierge_needs_info: null,
    });
  });

  it("every YouTubeProjectStatus either stages or keeps STATUS_LABELS", () => {
    const statuses = Object.keys(STATUS_LABELS) as YouTubeProjectStatus[];
    for (const status of statuses) {
      const stage = customerStage(status);
      const detail = customerStageDetail(status);
      assert.equal(detail, STATUS_LABELS[status]);
      if (status === "ready") assert.equal(stage, "done");
      else if (QUEUED_STATUSES.has(status)) assert.equal(stage, "queued");
      else if (status === "concierge_in_progress" || IN_FLIGHT_STATUSES.has(status)) {
        assert.equal(stage, "in_progress");
      } else {
        assert.equal(stage, null);
      }
    }
  });
});
